const ROOM_CODE_PATTERN = /^[A-Z0-9]{3,9}$/;
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_MAX_PARTICIPANTS = 10;

const configuredMaxParticipants = Number(process.env.MAX_PARTICIPANTS_PER_ROOM);
const MAX_PARTICIPANTS_PER_ROOM =
  Number.isInteger(configuredMaxParticipants) && configuredMaxParticipants > 0
    ? configuredMaxParticipants
    : DEFAULT_MAX_PARTICIPANTS;

const rooms = new Map();
const roomVoiceUsers = new Map();
const socketRooms = new Map();
const roomMessages = new Map();
const roomDetails = new Map();
const roomExpiryTimers = new Map();
const expiredRoomCodes = new Set();
const DEFAULT_TEMPORARY_ROOM_TTL_MS = 5 * 60 * 60 * 1000;
const configuredRoomTtl = Number(process.env.QUICK_ROOM_TTL_MS);
const TEMPORARY_ROOM_TTL_MS = Number.isFinite(configuredRoomTtl) && configuredRoomTtl > 0
  ? configuredRoomTtl
  : DEFAULT_TEMPORARY_ROOM_TTL_MS;
let roomExpiryHandler = null;

export function setRoomExpiryHandler(handler) {
  roomExpiryHandler = typeof handler === "function" ? handler : null;
}

function createRoomDetails(code, name) {
  const createdAt = Date.now();
  return {
    code,
    name: normalizeRoomName(name, code),
    createdAt,
    expiresAt: createdAt + TEMPORARY_ROOM_TTL_MS
  };
}

function expireRoom(code) {
  const room = rooms.get(code);
  if (!room) return;

  const participants = Array.from(room.values());
  expiredRoomCodes.add(code);
  cancelRoomExpiry(code);
  rooms.delete(code);
  roomVoiceUsers.delete(code);
  roomMessages.delete(code);
  roomDetails.delete(code);
  participants.forEach((participant) => socketRooms.delete(participant.socketId));
  roomExpiryHandler?.({ roomCode: code, participants, ttlMs: TEMPORARY_ROOM_TTL_MS });
  console.log(`[ROOM] expired ${code}`);
}

function cancelRoomExpiry(code) {
  const timer = roomExpiryTimers.get(code);
  if (timer) clearTimeout(timer);
  roomExpiryTimers.delete(code);
}

function scheduleRoomExpiry(code) {
  cancelRoomExpiry(code);
  const expiresAt = roomDetails.get(code)?.expiresAt || Date.now() + TEMPORARY_ROOM_TTL_MS;
  const delay = Math.max(0, expiresAt - Date.now());
  roomExpiryTimers.set(code, setTimeout(() => {
    expireRoom(code);
  }, delay));
}

export function normalizeRoomCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function normalizeRoomName(name, roomCode = "") {
  const cleanName = String(name || "").trim().slice(0, 24);
  return cleanName || `Sala ${normalizeRoomCode(roomCode)}`;
}

export function isValidRoomName(name) {
  const cleanName = String(name || "").trim();
  return cleanName.length >= 1 && cleanName.length <= 24 && !/[<>]/.test(cleanName);
}

export function isValidRoomCode(code) {
  return ROOM_CODE_PATTERN.test(normalizeRoomCode(code));
}

export function normalizeNickname(nickname) {
  return String(nickname || "").trim().slice(0, 24);
}

export function isValidNickname(nickname) {
  const clean = normalizeNickname(nickname);
  return clean.length >= 1 && clean.length <= 24;
}

export function createRoomCode() {
  let code = "";

  do {
    code = Array.from({ length: 6 }, () => {
      const index = Math.floor(Math.random() * ROOM_ALPHABET.length);
      return ROOM_ALPHABET[index];
    }).join("");
  } while (rooms.has(code));

  rooms.set(code, new Map());
  roomVoiceUsers.set(code, new Set());
  roomMessages.set(code, []);
  expiredRoomCodes.delete(code);
  roomDetails.set(code, createRoomDetails(code, ""));
  scheduleRoomExpiry(code);
  console.log(`[ROOM] created ${code}`);
  return code;
}

export function createRoom(roomCode, roomName) {
  let code = normalizeRoomCode(roomCode);

  if (!code) {
    do {
      code = Array.from({ length: 6 }, () => {
        const index = Math.floor(Math.random() * ROOM_ALPHABET.length);
        return ROOM_ALPHABET[index];
      }).join("");
    } while (rooms.has(code));
  }

  if (!isValidRoomCode(code)) {
    return { ok: false, error: "Codigo de sala invalido." };
  }

  if (!isValidRoomName(roomName)) {
    return { ok: false, error: "Nome da sala invalido." };
  }

  if (rooms.has(code)) {
    return { ok: false, error: "Sala ja existe." };
  }

  rooms.set(code, new Map());
  roomVoiceUsers.set(code, new Set());
  roomMessages.set(code, []);
  expiredRoomCodes.delete(code);
  const details = createRoomDetails(code, roomName);
  roomDetails.set(code, details);
  scheduleRoomExpiry(code);
  console.log(`[ROOM] created ${code}`);
  return { ok: true, room: details };
}

export function hasRoom(roomCode) {
  return rooms.has(normalizeRoomCode(roomCode));
}

export function joinRoom(roomCode, socketId, nickname, identity = {}) {
  const code = normalizeRoomCode(roomCode);

  if (!isValidRoomCode(code)) {
    return { ok: false, error: "Codigo de sala invalido." };
  }

  const room = rooms.get(code);

  if (!room) {
    return { ok: false, error: expiredRoomCodes.has(code) ? "Esta Sala Rápida expirou." : "Sala nao encontrada." };
  }

  if (room.size >= MAX_PARTICIPANTS_PER_ROOM && !room.has(socketId)) {
    return { ok: false, error: "Sala cheia." };
  }

  let cleanNickname = normalizeNickname(nickname);

  if (!isValidNickname(cleanNickname)) {
    return { ok: false, error: "Nickname invalido." };
  }

  const isGuest = Boolean(identity.isGuest);
  if (isGuest) {
    const namesInRoom = new Set(Array.from(room.values()).map((participant) => participant.nickname));
    let attempt = 0;
    while (namesInRoom.has(cleanNickname) && attempt < 12) {
      cleanNickname = `User ${100 + Math.floor(Math.random() * 9900)}`;
      attempt += 1;
    }
  }
  const displayName = isGuest ? cleanNickname : String(identity.displayName || cleanNickname).trim().slice(0, 40) || cleanNickname;
  const username = String(identity.username || "").trim().toLowerCase().slice(0, 24);
  const avatarUrl = !isGuest && typeof identity.avatarUrl === "string" && identity.avatarUrl.length <= 500000 ? identity.avatarUrl : "";
  let avatarVariant = isGuest && Number.isInteger(identity.avatarVariant) ? Math.abs(identity.avatarVariant) % 6 : 0;
  if (isGuest) {
    const usedVariants = new Set(Array.from(room.values()).filter((participant) => participant.isGuest).map((participant) => participant.avatarVariant));
    let variantAttempts = 0;
    while (usedVariants.has(avatarVariant) && variantAttempts < 6) {
      avatarVariant = (avatarVariant + 1) % 6;
      variantAttempts += 1;
    }
  }

  const participant = {
    ...room.get(socketId),
    socketId,
    userId: String(identity.userId || "").trim(),
    nickname: cleanNickname,
    displayName,
    username,
    isGuest,
    status: "online",
    inRoom: true,
    avatarUrl,
    avatarVariant,
    micEnabled: room.get(socketId)?.micEnabled ?? false,
    cameraEnabled: room.get(socketId)?.cameraEnabled ?? false,
    isScreenSharing: room.get(socketId)?.isScreenSharing ?? false,
    isSpeaking: room.get(socketId)?.isSpeaking ?? false
  };
  room.set(socketId, participant);
  roomVoiceUsers.get(code)?.add(socketId);
  socketRooms.set(socketId, code);

  console.log(`[ROOM] ${cleanNickname} joined ${code}`);

  return {
    ok: true,
    roomCode: code,
    roomName: getRoomDetails(code).name,
    participant,
    participants: getParticipants(code)
  };
}

export function leaveRoom(socketId) {
  const roomCode = socketRooms.get(socketId);

  if (!roomCode) {
    return null;
  }

  const room = rooms.get(roomCode);
  const participant = room?.get(socketId);

  if (room) {
    room.delete(socketId);

    if (participant) {
      console.log(`[ROOM] ${participant.nickname} left ${roomCode}`);
    }

  }

  socketRooms.delete(socketId);

  return participant ? { roomCode, participant } : null;
}

export function getParticipants(roomCode) {
  return Array.from(rooms.get(normalizeRoomCode(roomCode))?.values() || []);
}

export function getVoiceParticipants(roomCode) {
  const code = normalizeRoomCode(roomCode);
  const room = rooms.get(code);
  const voiceUsers = roomVoiceUsers.get(code);

  if (!room || !voiceUsers) {
    return [];
  }

  return Array.from(voiceUsers)
    .map((socketId) => room.get(socketId))
    .filter(Boolean);
}

export function joinVoice(socketId) {
  const roomCode = socketRooms.get(socketId);
  const voiceUsers = roomCode && roomVoiceUsers.get(roomCode);
  const participant = roomCode && rooms.get(roomCode)?.get(socketId);

  if (!roomCode || !voiceUsers || !participant) {
    return null;
  }

  voiceUsers.add(socketId);
  return { roomCode, participant, participants: getVoiceParticipants(roomCode) };
}

export function leaveVoice(socketId) {
  const roomCode = socketRooms.get(socketId);
  const voiceUsers = roomCode && roomVoiceUsers.get(roomCode);
  const participant = roomCode && rooms.get(roomCode)?.get(socketId);

  if (!roomCode || !voiceUsers || !participant || !voiceUsers.has(socketId)) {
    return null;
  }

  voiceUsers.delete(socketId);
  return { roomCode, participant, participants: getVoiceParticipants(roomCode) };
}

export function getMaxParticipantsPerRoom() {
  return MAX_PARTICIPANTS_PER_ROOM;
}

export function getRoomDetails(roomCode) {
  const code = normalizeRoomCode(roomCode);
  return roomDetails.get(code) || { code, name: `Sala ${code}`, createdAt: null, expiresAt: null };
}

export function updateParticipantNickname(socketId, nickname) {
  const roomCode = socketRooms.get(socketId);
  const cleanNickname = normalizeNickname(nickname);

  if (!roomCode) {
    return { ok: false, error: "Voce nao esta em uma sala." };
  }

  if (!isValidNickname(cleanNickname)) {
    return { ok: false, error: "Nickname invalido." };
  }

  const room = rooms.get(roomCode);
  const participant = room?.get(socketId);

  if (!room || !participant) {
    return { ok: false, error: "Voce nao esta em uma sala." };
  }

  const updatedParticipant = { ...participant, nickname: cleanNickname };
  room.set(socketId, updatedParticipant);

  return {
    ok: true,
    roomCode,
    participant: updatedParticipant,
    participants: getParticipants(roomCode)
  };
}

export function updateParticipantMediaStatus(socketId, status = {}) {
  const roomCode = socketRooms.get(socketId);
  const room = roomCode ? rooms.get(roomCode) : null;
  const participant = room?.get(socketId);

  if (!room || !participant) {
    return null;
  }

  const updatedParticipant = {
    ...participant,
    micEnabled: Boolean(status.micEnabled),
    cameraEnabled: Boolean(status.cameraEnabled),
    isScreenSharing: Boolean(status.isScreenSharing),
    isSpeaking: status.micEnabled ? participant.isSpeaking ?? false : false
  };

  room.set(socketId, updatedParticipant);
  return { roomCode, participant: updatedParticipant };
}

export function updateParticipantSpeakingStatus(socketId, isSpeaking) {
  const roomCode = socketRooms.get(socketId);
  const room = roomCode ? rooms.get(roomCode) : null;
  const voiceUsers = roomCode ? roomVoiceUsers.get(roomCode) : null;
  const participant = room?.get(socketId);

  if (!room || !participant || !voiceUsers?.has(socketId)) {
    return null;
  }

  const updatedParticipant = { ...participant, isSpeaking: Boolean(isSpeaking) };
  room.set(socketId, updatedParticipant);
  return { roomCode, participant: updatedParticipant };
}

export function getSocketRoom(socketId) {
  return socketRooms.get(socketId);
}

export function areSocketsInSameRoom(fromSocketId, toSocketId) {
  const fromRoom = socketRooms.get(fromSocketId);
  const toRoom = socketRooms.get(toSocketId);
  return Boolean(fromRoom && toRoom && fromRoom === toRoom);
}

export function getRoomSize(roomCode) {
  return rooms.get(normalizeRoomCode(roomCode))?.size || 0;
}

export function getRoomMessages(roomCode) {
  return [...(roomMessages.get(normalizeRoomCode(roomCode)) || [])];
}

export function addRoomMessage(roomCode, message) {
  const code = normalizeRoomCode(roomCode);
  const messages = roomMessages.get(code);

  if (!messages) {
    return null;
  }

  messages.push(message);

  if (messages.length > 200) {
    messages.splice(0, messages.length - 200);
  }

  return message;
}
