import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { unlink } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { Server } from "socket.io";
import { getSessionTokenFromCookieHeader, optionalAuth, registerAuthRoutes, requireAuth, startSessionCleanup } from "./auth.js";
import {
  attachSocialSocket,
  authenticateSocket,
  configureSocialSocket,
  registerAccountPresence,
  registerSocialRoutes
} from "./social.js";
import { areSocketsInSameServerVoice, attachServerSocket, getServerVoiceRoom, registerServerRoutes } from "./serverRoutes.js";
import { checkDatabase, getDatabaseError, isDatabaseConfigured } from "./db/pool.js";
import { getConversationForUser } from "./db/social.js";
import { getServerForUser, isUuid } from "./db/servers.js";
import { markRoomActivityLeft, recordRoomActivity } from "./db/roomActivity.js";
import {
  areSocketsInSameRoom,
  addRoomMessage,
  createRoom,
  getMaxParticipantsPerRoom,
  getParticipants,
  getRoomSize,
  getRoomMessages,
  getRoomDetails,
  getSocketRoom,
  getVoiceParticipants,
  hasRoom,
  isValidNickname,
  isValidRoomCode,
  joinRoom,
  joinVoice,
  leaveRoom,
  leaveVoice,
  normalizeNickname,
  normalizeRoomCode,
  setRoomExpiryHandler,
  updateParticipantMediaStatus,
  updateParticipantSpeakingStatus,
  updateParticipantNickname
} from "./rooms.js";

const PORT = Number(process.env.PORT) || 3001;
const HOST = "0.0.0.0";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173";
const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST_DIR = path.resolve(SERVER_DIR, "../../client/dist");
const UPLOAD_DIR = path.resolve(SERVER_DIR, "../uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });
const UPLOAD_LIMITS = Object.freeze({ image: 15 * 1024 * 1024, video: 50 * 1024 * 1024, file: 25 * 1024 * 1024 });
const MAX_UPLOAD_SIZE = UPLOAD_LIMITS.video;
const ALLOWED_UPLOADS = new Map([
  ["image/png", [".png"]],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/webp", [".webp"]],
  ["image/gif", [".gif"]],
  ["video/mp4", [".mp4"]],
  ["video/webm", [".webm"]],
  ["video/quicktime", [".mov"]],
  ["application/pdf", [".pdf"]],
  ["application/zip", [".zip"]],
  ["application/x-zip-compressed", [".zip"]],
  ["audio/mpeg", [".mp3"]],
  ["audio/wav", [".wav"]],
  ["audio/ogg", [".ogg"]],
  ["text/plain", [".txt"]],
  ["application/msword", [".doc"]],
  ["application/vnd.ms-excel", [".xls"]],
  ["application/vnd.ms-powerpoint", [".ppt"]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [".docx"]],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", [".xlsx"]],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", [".pptx"]]
]);

function uploadKind(mimeType) {
  if (String(mimeType || "").startsWith("image/")) return "image";
  if (String(mimeType || "").startsWith("video/")) return "video";
  return "file";
}

function uploadLimitFor(mimeType) {
  return UPLOAD_LIMITS[uploadKind(mimeType)];
}

function formatRoomDuration(ttlMs) {
  const totalMinutes = Math.max(1, Math.round(Number(ttlMs) / 60000));
  if (totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60;
    return `${hours} hora${hours === 1 ? "" : "s"}`;
  }
  return `${totalMinutes} minuto${totalMinutes === 1 ? "" : "s"}`;
}

const app = express();
app.use(express.json());
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use("/uploads", express.static(UPLOAD_DIR, { index: false }));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_request, file, callback) => {
      callback(null, `${crypto.randomUUID()}${ALLOWED_UPLOADS.get(file.mimetype)?.[0] || ".bin"}`);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedExtensions = ALLOWED_UPLOADS.get(file.mimetype);
    callback(null, Boolean(expectedExtensions?.includes(extension)));
  }
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.post("/rooms/:roomCode/upload", (request, response) => {
  upload.single("file")(request, response, async (error) => {
    if (error) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      response.status(status).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Este arquivo ultrapassa o limite permitido." : "Arquivo invalido." });
      return;
    }

    const roomCode = normalizeRoomCode(request.params.roomCode);
    const socketId = String(request.query.socketId || "");
    const file = request.file;
    const extension = file ? path.extname(file.originalname).toLowerCase() : "";
    const expectedExtensions = file ? ALLOWED_UPLOADS.get(file.mimetype) : null;

    if (!hasRoom(roomCode) || getSocketRoom(socketId) !== roomCode) {
      if (file) {
        await unlink(file.path).catch(() => {});
      }
      return response.status(403).json({ error: "Voce nao pertence a esta sala." });
    }

    if (!file || !expectedExtensions?.includes(extension)) {
      if (file) {
        await unlink(file.path).catch(() => {});
      }
      return response.status(400).json({ error: "Tipo de arquivo nao permitido." });
    }

    if (file.size > uploadLimitFor(file.mimetype)) {
      await unlink(file.path).catch(() => {});
      return response.status(413).json({ error: "Este arquivo ultrapassa o limite permitido." });
    }

    const type = file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : "file";
    return response.json({
      attachment: {
        type,
        url: `/uploads/${file.filename}`,
        name: file.originalname.replace(/[\\/\0]/g, "").slice(0, 120),
        size: file.size,
        mimeType: file.mimetype
      }
    });
  });
});

app.post("/api/social/dms/:conversationId/upload", optionalAuth, requireAuth, (request, response) => {
  upload.single("file")(request, response, async (error) => {
    if (error) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      response.status(status).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Este arquivo ultrapassa o limite permitido." : "Arquivo invalido." });
      return;
    }
    const conversation = await getConversationForUser(request.params.conversationId, request.user.id).catch(() => null);
    const file = request.file;
    const extension = file ? path.extname(file.originalname).toLowerCase() : "";
    const expectedExtensions = file ? ALLOWED_UPLOADS.get(file.mimetype) : null;
    if (!conversation || conversation.user?.isOfficial || !file || !expectedExtensions?.includes(extension)) {
      if (file) await unlink(file.path).catch(() => {});
      return response.status(conversation?.user?.isOfficial ? 403 : 400).json({ error: conversation?.user?.isOfficial ? "Essa conversa oficial e somente leitura." : "Tipo de arquivo nao permitido." });
    }
    if (file.size > uploadLimitFor(file.mimetype)) {
      await unlink(file.path).catch(() => {});
      return response.status(413).json({ error: "Este arquivo ultrapassa o limite permitido." });
    }
    const type = file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : "file";
    return response.json({ attachment: {
      type,
      url: `/uploads/${file.filename}`,
      name: file.originalname.replace(/[\\/\0]/g, "").slice(0, 120),
      size: file.size,
      mimeType: file.mimetype
    } });
  });
});

app.post("/api/servers/:serverId/channels/:channelId/upload", optionalAuth, requireAuth, (request, response) => {
  upload.single("file")(request, response, async (error) => {
    if (error) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      response.status(status).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Este arquivo ultrapassa o limite permitido." : "Arquivo invalido." });
      return;
    }

    const { serverId, channelId } = request.params;
    const file = request.file;
    const server = isUuid(serverId) && isUuid(channelId) ? await getServerForUser(serverId, request.user.id).catch(() => null) : null;
    const channel = server?.channels?.find((item) => item.id === channelId && item.type === "text");
    const extension = file ? path.extname(file.originalname).toLowerCase() : "";
    const expectedExtensions = file ? ALLOWED_UPLOADS.get(file.mimetype) : null;

    if (!server || !channel || !file || !expectedExtensions?.includes(extension)) {
      if (file) await unlink(file.path).catch(() => {});
      return response.status(server && !channel ? 400 : 403).json({ error: !server ? "Servidor indisponivel." : !channel ? "Canal de texto indisponivel." : "Tipo de arquivo nao permitido." });
    }
    if (file.size > uploadLimitFor(file.mimetype)) {
      await unlink(file.path).catch(() => {});
      return response.status(413).json({ error: "Este arquivo ultrapassa o limite permitido." });
    }

    const type = file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : "file";
    return response.json({ attachment: {
      type,
      url: `/uploads/${file.filename}`,
      name: file.originalname.replace(/[\\/\0]/g, "").slice(0, 120),
      size: file.size,
      mimeType: file.mimetype
    } });
  });
});

app.get("/ice-config", (_request, response) => {
  const iceServers = [];

  if (process.env.STUN_URL) {
    iceServers.push({ urls: process.env.STUN_URL });
  } else {
    iceServers.push({ urls: "stun:stun.l.google.com:19302" });
  }

  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME || "",
      credential: process.env.TURN_CREDENTIAL || ""
    });
  }

  response.json({ iceServers });
});

registerAuthRoutes(app);
registerSocialRoutes(app);
registerServerRoutes(app);

if (existsSync(CLIENT_DIST_DIR)) {
  app.use("/assets", express.static(path.join(CLIENT_DIST_DIR, "assets")));
  app.use(express.static(CLIENT_DIST_DIR));
  app.use("/assets", (_request, response) => {
    response.status(404).type("text").send("Asset not found.");
  });
  app.get("*", (_request, response, next) => {
    response.sendFile(path.join(CLIENT_DIST_DIR, "index.html"), (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  }
});

setRoomExpiryHandler(({ roomCode, participants, ttlMs }) => {
  io.to(roomCode).emit("room-expired", {
    roomCode,
    participants,
    message: "Esta Sala Rápida expirou.",
    detail: `A conversa foi encerrada após ${formatRoomDuration(ttlMs)}.`
  });
  participants.forEach((participant) => {
    io.sockets.sockets.get(participant.socketId)?.leave(roomCode);
  });
});

configureSocialSocket(io);
io.use(async (socket, next) => {
  const sessionCookiePresent = Boolean(getSessionTokenFromCookieHeader(socket.handshake.headers.cookie || ""));
  socket.data.accountUser = await authenticateSocket(socket);
  socket.data.sessionCookiePresent = sessionCookiePresent;
  socket.data.authenticated = Boolean(socket.data.accountUser);
  next();
});

// Typing presence is ephemeral and scoped to the connected socket only.
const typingSockets = new Map();
const typingTimers = new Map();

function canSignal(socket, to) {
  if (areSocketsInSameServerVoice(socket.id, to)) {
    return Boolean(to && io.sockets.sockets.has(to));
  }
  const voiceParticipants = getVoiceParticipants(getSocketRoom(socket.id));
  return Boolean(
    to &&
      io.sockets.sockets.has(to) &&
      getSocketRoom(socket.id) &&
      areSocketsInSameRoom(socket.id, to) &&
      voiceParticipants.some((participant) => participant.socketId === socket.id) &&
      voiceParticipants.some((participant) => participant.socketId === to)
  );
}

function emitRoomError(socket, message) {
  socket.emit("room-error", { message });
}

function emitRoomRoster(roomCode) {
  const code = normalizeRoomCode(roomCode);
  const participants = getParticipants(code);
  const details = getRoomDetails(code);

  io.to(code).emit("room-roster", {
    roomCode: code,
    roomName: details.name,
    createdAt: details.createdAt,
    expiresAt: details.expiresAt,
    participants,
    voiceParticipants: getVoiceParticipants(code),
    count: participants.length,
    maxParticipants: getMaxParticipantsPerRoom()
  });
}

function clearTyping(socket, announce = true) {
  const roomCode = typingSockets.get(socket.id);
  const timer = typingTimers.get(socket.id);

  if (timer) {
    clearTimeout(timer);
    typingTimers.delete(socket.id);
  }

  typingSockets.delete(socket.id);

  if (announce && roomCode) {
    socket.to(roomCode).emit("typing:update", {
      socketId: socket.id,
      typing: false
    });
  }
}

function handleLeave(socket) {
  clearTyping(socket);

  const voiceResult = leaveVoice(socket.id);
  if (voiceResult) {
    socket.to(voiceResult.roomCode).emit("voice-user-left", {
      participant: voiceResult.participant,
      participants: voiceResult.participants
    });
  }

  const result = leaveRoom(socket.id);

  if (!result) {
    return;
  }

  if (result.participant.userId) {
    markRoomActivityLeft(result.participant.userId, result.roomCode).catch((error) => {
      console.warn("[ROOM] activity leave could not be recorded:", error.message);
    });
  }

  socket.leave(result.roomCode);
  console.log("[leave-room]", result.roomCode, socket.id, "users:", getRoomSize(result.roomCode));
  socket.to(result.roomCode).emit("user-left", {
    participant: result.participant,
    participants: getParticipants(result.roomCode),
    count: getRoomSize(result.roomCode),
    maxParticipants: getMaxParticipantsPerRoom()
  });
  emitRoomRoster(result.roomCode);

  if (getRoomSize(result.roomCode) === 0) {
    console.log("[room-empty]", result.roomCode, "retained until TTL expiry");
  }
}

io.on("connection", (socket) => {
  registerAccountPresence(io, socket, socket.data.accountUser);
  attachSocialSocket(io, socket);
  attachServerSocket(io, socket);

  socket.on("create-room", ({ roomCode, roomName } = {}) => {
    const result = createRoom(roomCode, roomName);

    if (!result.ok) {
      emitRoomError(socket, result.error);
      return;
    }

    socket.emit("room-created", {
      roomCode: result.room.code,
      roomName: result.room.name,
      createdAt: result.room.createdAt,
      expiresAt: result.room.expiresAt
    });
  });

  socket.on("join-room", ({ roomCode, nickname, identity } = {}) => {
    const code = normalizeRoomCode(roomCode);
    const cleanNickname = normalizeNickname(nickname);
    const requestedAccount = identity && typeof identity === "object" && identity.isGuest === false;

    if (!isValidRoomCode(code)) {
      emitRoomError(socket, "Codigo de sala invalido.");
      return;
    }

    const currentRoomCode = getSocketRoom(socket.id);
    if (currentRoomCode && currentRoomCode !== code) {
      handleLeave(socket);
    }

    const authenticatedUser = socket.data.accountUser;
    if (requestedAccount && !authenticatedUser) {
      console.warn("[room-auth-mismatch]", {
        roomCode,
        normalizedRoom: code,
        socketId: socket.id,
        authenticated: false,
        sessionCookiePresent: Boolean(socket.data.sessionCookiePresent),
        participantId: null
      });
      emitRoomError(socket, "Nao foi possivel validar sua conta. Recarregue a pagina e tente novamente.");
      return;
    }
    const resolvedIdentity = authenticatedUser
      ? {
          userId: authenticatedUser.id,
          displayName: authenticatedUser.displayName || authenticatedUser.username,
          username: authenticatedUser.username,
          avatarUrl: authenticatedUser.avatarUrl || "",
          isGuest: false,
          avatarVariant: 0
        }
      : {
          ...(identity && typeof identity === "object" ? identity : {}),
          userId: "",
          isGuest: Boolean(identity?.isGuest)
        };
    const result = joinRoom(code, socket.id, cleanNickname, resolvedIdentity);

    if (!result.ok) {
      emitRoomError(socket, result.error);
      return;
    }

    if (result.participant.userId) {
      recordRoomActivity(result.participant.userId, code, result.roomName).catch((error) => {
        console.warn("[ROOM] activity join could not be recorded:", error.message);
      });
    }

    socket.join(code);
    const existingParticipants = result.participants.filter(
      (participant) => participant.socketId !== socket.id
    );
    const roomDetails = getRoomDetails(code);

    socket.emit("room-users", {
      roomCode: code,
      roomName: result.roomName,
      createdAt: roomDetails.createdAt,
      expiresAt: roomDetails.expiresAt,
      self: result.participant,
      participants: existingParticipants,
      voiceParticipants: getVoiceParticipants(code).filter((participant) => participant.socketId !== socket.id),
      count: result.participants.length,
      maxParticipants: getMaxParticipantsPerRoom()
    });
    socket.emit("message-history", {
      channelId: "general",
      messages: getRoomMessages(code)
    });
    console.info("[room-join-diagnostic]", {
      roomCode,
      normalizedRoom: code,
      socketId: socket.id,
      authenticated: Boolean(authenticatedUser),
      participantId: result.participant.userId || null,
      participantsCount: result.participants.length
    });
    console.log("[join-room]", code, socket.id, authenticatedUser ? "account" : "guest", cleanNickname, "users:", result.participants.length);
    console.log("[join-voice]", code, socket.id, "voiceUsers:", result.participants.length);

    socket.to(code).emit("user-joined", {
      participant: result.participant,
      roomName: result.roomName,
      createdAt: roomDetails.createdAt,
      expiresAt: roomDetails.expiresAt,
      participants: result.participants,
      voiceParticipants: getVoiceParticipants(code),
      count: result.participants.length,
      maxParticipants: getMaxParticipantsPerRoom()
    });
    emitRoomRoster(code);
  });

  socket.on("join-voice", () => {
    const result = joinVoice(socket.id);

    if (!result) {
      return;
    }

    const existingParticipants = result.participants.filter((participant) => participant.socketId !== socket.id);
    socket.emit("voice-users", { participants: existingParticipants });
    socket.to(result.roomCode).emit("voice-user-joined", {
      participant: result.participant,
      participants: result.participants
    });
    console.log("[join-voice]", result.roomCode, socket.id, "voiceUsers:", result.participants.length);
  });

  socket.on("leave-voice", () => {
    const result = leaveVoice(socket.id);

    if (!result) {
      return;
    }

    socket.to(result.roomCode).emit("voice-user-left", {
      participant: result.participant,
      participants: result.participants
    });
    socket.emit("voice-left");
    console.log("[leave-voice]", result.roomCode, socket.id, "voiceUsers:", result.participants.length);
  });

  socket.on("update-nickname", ({ nickname } = {}) => {
    const result = updateParticipantNickname(socket.id, nickname);

    if (!result.ok) {
      socket.emit("nickname-error", { message: result.error });
      return;
    }

    io.to(result.roomCode).emit("nickname-updated", {
      participant: result.participant,
      participants: result.participants,
      voiceParticipants: getVoiceParticipants(result.roomCode),
      count: result.participants.length,
      maxParticipants: getMaxParticipantsPerRoom()
    });
  });

  socket.on("send-message", ({ channelId, content, attachment } = {}) => {
    const roomCode = getSocketRoom(socket.id);
    const participant = roomCode && getParticipants(roomCode).find((item) => item.socketId === socket.id);
    const cleanContent = String(content || "").trim();
    const validChannel = channelId === "general";
    const validAttachment = Boolean(
      attachment &&
        (attachment.type === "image" || attachment.type === "video" || attachment.type === "file") &&
        typeof attachment.url === "string" &&
        /^\/uploads\/[A-Za-z0-9._-]+$/.test(attachment.url) &&
        Number.isInteger(attachment.size) &&
        attachment.size <= uploadLimitFor(attachment.mimeType)
    );

    if (!roomCode || !participant || !validChannel) {
      socket.emit("message-error", { message: "Canal indisponivel." });
      return;
    }

    if (cleanContent.length > 4000 || (!cleanContent && !validAttachment)) {
      socket.emit("message-error", { message: "A mensagem deve ter texto ou um anexo e ter no maximo 4.000 caracteres." });
      return;
    }

    const message = {
      id: crypto.randomUUID(),
      roomCode,
      channelId: "general",
      socketId: socket.id,
      nickname: participant.nickname,
      type: cleanContent && validAttachment ? "text-with-attachment" : validAttachment ? "attachment" : "text",
      content: cleanContent,
      attachment: validAttachment ? attachment : null,
      createdAt: new Date().toISOString()
    };

    addRoomMessage(roomCode, message);
    io.to(roomCode).emit("message-created", message);
  });

  socket.on("typing:start", () => {
    const roomCode = getSocketRoom(socket.id);
    const participant = roomCode && getParticipants(roomCode).find((item) => item.socketId === socket.id);

    if (!roomCode || !participant) {
      return;
    }

    clearTyping(socket, false);
    typingSockets.set(socket.id, roomCode);
    socket.to(roomCode).emit("typing:update", {
      socketId: socket.id,
      displayName: participant.nickname,
      typing: true
    });
    typingTimers.set(socket.id, setTimeout(() => clearTyping(socket), 4000));
  });

  socket.on("typing:stop", () => {
    clearTyping(socket);
  });

  socket.on("webrtc-offer", ({ to, offer } = {}) => {
    if (!canSignal(socket, to)) {
      return;
    }

    io.to(to).emit("webrtc-offer", { from: socket.id, offer });
  });

  socket.on("webrtc-answer", ({ to, answer } = {}) => {
    if (!canSignal(socket, to)) {
      return;
    }

    io.to(to).emit("webrtc-answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate } = {}) => {
    if (!canSignal(socket, to)) {
      return;
    }

    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("screen-share-status", ({ isScreenSharing } = {}) => {
    const roomCode = getSocketRoom(socket.id) || getServerVoiceRoom(socket.id);

    if (!roomCode) {
      return;
    }

    socket.to(roomCode).emit("screen-share-status", {
      from: socket.id,
      isScreenSharing: Boolean(isScreenSharing)
    });
  });

  socket.on("media-status", ({ micEnabled, cameraEnabled, isScreenSharing } = {}) => {
    const result = updateParticipantMediaStatus(socket.id, {
      micEnabled,
      cameraEnabled,
      isScreenSharing
    });

    if (!result) {
      return;
    }

    socket.to(result.roomCode).emit("media-status", {
      from: socket.id,
      micEnabled: result.participant.micEnabled,
      cameraEnabled: result.participant.cameraEnabled,
      isScreenSharing: result.participant.isScreenSharing
    });
  });

  socket.on("speaking-state", ({ isSpeaking } = {}) => {
    const result = updateParticipantSpeakingStatus(socket.id, Boolean(isSpeaking));

    if (!result) {
      return;
    }

    socket.to(result.roomCode).emit("speaking-state", {
      from: socket.id,
      isSpeaking: result.participant.isSpeaking
    });
  });

  socket.on("leave-room", () => {
    handleLeave(socket);
  });

  socket.on("disconnect", () => {
    console.log("[disconnect]", socket.id);
    handleLeave(socket);
  });
});

httpServer.listen(PORT, HOST, async () => {
  console.log(`[SERVER] listening on ${HOST}:${PORT}`);
  if (!isDatabaseConfigured) {
    console.log("[DB] DATABASE_URL nao configurada; autenticacao de contas desativada.");
    return;
  }

  if (await checkDatabase()) {
    console.log("[DB] PostgreSQL conectado.");
    startSessionCleanup();
    return;
  }

  const error = getDatabaseError();
  console.log(`[DB] autenticacao de contas indisponivel${error ? `: ${error.message}` : "."}`);
});
