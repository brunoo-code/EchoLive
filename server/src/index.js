import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { Server } from "socket.io";
import {
  areSocketsInSameRoom,
  addRoomMessage,
  createRoom,
  getMaxParticipantsPerRoom,
  getParticipants,
  getRoomSize,
  getRoomMessages,
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
  updateParticipantMediaStatus,
  updateParticipantSpeakingStatus,
  updateParticipantNickname
} from "./rooms.js";

const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173";
const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST_DIR = path.resolve(SERVER_DIR, "../../client/dist");
const UPLOAD_DIR = path.resolve(SERVER_DIR, "../uploads");
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
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
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [".docx"]],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", [".xlsx"]],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", [".pptx"]]
]);

const app = express();
app.use(express.json());
app.use(cors({ origin: CLIENT_ORIGIN }));
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
      response.status(status).json({ error: "Arquivo invalido ou maior que 100 MB." });
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
    methods: ["GET", "POST"]
  }
});

const typingSockets = new Map();
const typingTimers = new Map();

function canSignal(socket, to) {
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

  socket.leave(result.roomCode);
  console.log("[leave-room]", result.roomCode, socket.id, "users:", getRoomSize(result.roomCode));
  socket.to(result.roomCode).emit("user-left", {
    participant: result.participant,
    participants: getParticipants(result.roomCode),
    count: getRoomSize(result.roomCode),
    maxParticipants: getMaxParticipantsPerRoom()
  });

  if (getRoomSize(result.roomCode) === 0) {
    console.log("[room-deleted]", result.roomCode);
  }
}

io.on("connection", (socket) => {
  socket.on("create-room", ({ nickname, roomCode, roomName } = {}) => {
    const cleanNickname = normalizeNickname(nickname);

    if (!isValidNickname(cleanNickname)) {
      emitRoomError(socket, "Nickname invalido.");
      return;
    }

    const result = createRoom(roomCode, roomName);

    if (!result.ok) {
      emitRoomError(socket, result.error);
      return;
    }

    socket.emit("room-created", {
      roomCode: result.room.code,
      roomName: result.room.name
    });
  });

  socket.on("join-room", ({ roomCode, nickname } = {}) => {
    const code = normalizeRoomCode(roomCode);
    const cleanNickname = normalizeNickname(nickname);

    if (!isValidRoomCode(code)) {
      emitRoomError(socket, "Codigo de sala invalido.");
      return;
    }

    if (!hasRoom(code)) {
      emitRoomError(socket, "Sala nao encontrada.");
      return;
    }

    const currentRoomCode = getSocketRoom(socket.id);
    if (currentRoomCode && currentRoomCode !== code) {
      handleLeave(socket);
    }

    const result = joinRoom(code, socket.id, cleanNickname);

    if (!result.ok) {
      emitRoomError(socket, result.error);
      return;
    }

    socket.join(code);
    const existingParticipants = result.participants.filter(
      (participant) => participant.socketId !== socket.id
    );

    socket.emit("room-users", {
      roomCode: code,
      roomName: result.roomName,
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
    console.log("[join-room]", code, socket.id, cleanNickname, "users:", result.participants.length);
    console.log("[join-voice]", code, socket.id, "voiceUsers:", result.participants.length);

    socket.to(code).emit("user-joined", {
      participant: result.participant,
      roomName: result.roomName,
      participants: result.participants,
      voiceParticipants: getVoiceParticipants(code),
      count: result.participants.length,
      maxParticipants: getMaxParticipantsPerRoom()
    });
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
        attachment.size <= MAX_UPLOAD_SIZE
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
    const roomCode = getSocketRoom(socket.id);

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

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[SERVER] listening on port ${PORT}`);
});
