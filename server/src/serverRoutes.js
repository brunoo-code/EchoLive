import { optionalAuth, requireAuth } from "./auth.js";
import {
  createChannel,
  createServer,
  createServerInvite,
  createServerMessage,
  deleteChannel,
  deleteServer,
  deleteServerMessage,
  editServerMessage,
  getServerForUser,
  isUuid,
  joinServerByInvite,
  joinServerForUser,
  leaveServer,
  listServerMembers,
  listServerMessages,
  listServersForUser,
  revokeServerInvite,
  toggleServerMessageReaction,
  updateChannel,
  updateServer
} from "./db/servers.js";

const serverVoiceSessions = new Map();
const socketServerVoice = new Map();

function serverVoiceKey(serverId, channelId) {
  return `server:${serverId}:voice:${channelId}`;
}

function serverVoiceParticipant(socket) {
  const user = socket.data.accountUser;
  return {
    id: user.id,
    userId: user.id,
    socketId: socket.id,
    nickname: user.displayName || user.username,
    displayName: user.displayName || user.username,
    username: user.username,
    avatarUrl: user.avatarUrl || "",
    avatarVariant: 0,
    badges: user.badges || [],
    isGuest: false,
    inRoom: true,
    isLocal: false,
    isScreenSharing: false,
    isSpeaking: false,
    micEnabled: false,
    cameraEnabled: false
  };
}

export function getServerVoiceRoom(socketId) {
  return socketServerVoice.get(socketId) || "";
}

export function areSocketsInSameServerVoice(socketId, otherSocketId) {
  const room = getServerVoiceRoom(socketId);
  return Boolean(room && room === getServerVoiceRoom(otherSocketId));
}

function leaveServerVoice(socket, announce = true) {
  const key = socketServerVoice.get(socket.id);
  if (!key) return null;
  const session = serverVoiceSessions.get(key);
  const participant = session?.get(socket.id) || null;
  session?.delete(socket.id);
  socketServerVoice.delete(socket.id);
  socket.leave(key);
  if (!session?.size) serverVoiceSessions.delete(key);
  if (announce && participant) {
    socket.to(key).emit("server:voice-user-left", { participant, participants: Array.from(session?.values() || []) });
  }
  return { key, participant, participants: Array.from(session?.values() || []) };
}

function handleServerError(response, error) {
  if (error?.code === "DATABASE_UNAVAILABLE") return response.status(503).json({ error: "Servidores estao temporariamente indisponiveis.", code: "SERVER_UNAVAILABLE" });
  console.error("[SERVER] request failed:", error?.message || error);
  return response.status(500).json({ error: "Nao foi possivel concluir a operacao." });
}

function requireUuid(value, response, message = "Identificador invalido.") {
  if (!isUuid(value)) {
    response.status(400).json({ error: message, code: "INVALID_ID" });
    return false;
  }
  return true;
}

export function registerServerRoutes(app) {
  app.get("/api/servers", optionalAuth, requireAuth, async (request, response) => {
    try { return response.json({ servers: await listServersForUser(request.user.id) }); } catch (error) { return handleServerError(response, error); }
  });

  app.post("/api/servers", optionalAuth, requireAuth, async (request, response) => {
    try {
      const result = await createServer(request.user.id, request.body || {});
      if (result.error) return response.status(400).json(result);
      return response.status(201).json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.get("/api/servers/:serverId", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response)) return;
    try {
      const server = await getServerForUser(request.params.serverId, request.user.id);
      return server ? response.json({ server }) : response.status(404).json({ error: "Servidor nao encontrado.", code: "NOT_FOUND" });
    } catch (error) { return handleServerError(response, error); }
  });

  app.get("/api/servers/:serverId/members", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response)) return;
    try {
      const members = await listServerMembers(request.params.serverId, request.user.id);
      return members ? response.json({ members }) : response.status(404).json({ error: "Servidor nao encontrado.", code: "NOT_FOUND" });
    } catch (error) { return handleServerError(response, error); }
  });

  app.post("/api/servers/:serverId/join", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response)) return;
    try {
      const result = await joinServerForUser(request.params.serverId, request.user.id);
      return result.error ? response.status(result.code === "NOT_FOUND" ? 404 : 403).json(result) : response.json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.patch("/api/servers/:serverId", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response)) return;
    try {
      const result = await updateServer(request.params.serverId, request.user.id, request.body || {});
      return result.error ? response.status(result.code === "FORBIDDEN" ? 403 : 400).json(result) : response.json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.delete("/api/servers/:serverId", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response)) return;
    try {
      const result = await deleteServer(request.params.serverId, request.user.id);
      return result.error ? response.status(result.code === "FORBIDDEN" ? 403 : 400).json(result) : response.json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.post("/api/servers/:serverId/leave", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response)) return;
    try {
      const result = await leaveServer(request.params.serverId, request.user.id);
      return result.error ? response.status(result.code === "OWNER_CANNOT_LEAVE" ? 400 : 404).json(result) : response.json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.post("/api/servers/:serverId/channels", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response)) return;
    try {
      const result = await createChannel(request.params.serverId, request.user.id, request.body || {});
      return result.error ? response.status(result.code === "FORBIDDEN" ? 403 : 400).json(result) : response.status(201).json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.patch("/api/servers/:serverId/channels/:channelId", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response) || !requireUuid(request.params.channelId, response)) return;
    try {
      const result = await updateChannel(request.params.serverId, request.params.channelId, request.user.id, request.body || {});
      return result.error ? response.status(result.code === "FORBIDDEN" ? 403 : 400).json(result) : response.json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.delete("/api/servers/:serverId/channels/:channelId", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response) || !requireUuid(request.params.channelId, response)) return;
    try {
      const result = await deleteChannel(request.params.serverId, request.params.channelId, request.user.id);
      return result.error ? response.status(result.code === "FORBIDDEN" ? 403 : 404).json(result) : response.json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.get("/api/servers/:serverId/channels/:channelId/messages", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response) || !requireUuid(request.params.channelId, response)) return;
    try {
      const result = await listServerMessages(request.params.serverId, request.params.channelId, request.user.id, request.query);
      return result ? response.json(result) : response.status(404).json({ error: "Canal nao encontrado.", code: "NOT_FOUND" });
    } catch (error) { return handleServerError(response, error); }
  });

  app.post("/api/servers/:serverId/channels/:channelId/messages", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response) || !requireUuid(request.params.channelId, response)) return;
    try {
      const message = await createServerMessage(request.params.serverId, request.params.channelId, request.user.id, request.body || {});
      return message ? response.status(201).json({ message }) : response.status(400).json({ error: "A mensagem deve ter texto ou anexo e ter no maximo 4.000 caracteres." });
    } catch (error) { return handleServerError(response, error); }
  });

  app.patch("/api/servers/:serverId/channels/:channelId/messages/:messageId", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response) || !requireUuid(request.params.channelId, response) || !requireUuid(request.params.messageId, response)) return;
    try {
      const result = await editServerMessage(request.params.serverId, request.params.channelId, request.params.messageId, request.user.id, request.body?.content);
      return result.error ? response.status(result.code === "FORBIDDEN" ? 403 : 400).json(result) : response.json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.delete("/api/servers/:serverId/channels/:channelId/messages/:messageId", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response) || !requireUuid(request.params.channelId, response) || !requireUuid(request.params.messageId, response)) return;
    try {
      const result = await deleteServerMessage(request.params.serverId, request.params.channelId, request.params.messageId, request.user.id);
      return result.error ? response.status(result.code === "FORBIDDEN" ? 403 : 400).json(result) : response.json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.post("/api/servers/:serverId/channels/:channelId/messages/:messageId/reactions", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response) || !requireUuid(request.params.channelId, response) || !requireUuid(request.params.messageId, response)) return;
    try {
      const result = await toggleServerMessageReaction(request.params.serverId, request.params.channelId, request.params.messageId, request.user.id, request.body?.emoji);
      return result?.error ? response.status(result.code === "NOT_FOUND" ? 404 : 400).json(result) : result ? response.json(result) : response.status(404).json({ error: "Servidor nao encontrado.", code: "NOT_FOUND" });
    } catch (error) { return handleServerError(response, error); }
  });

  app.post("/api/servers/:serverId/invites", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response)) return;
    try {
      const result = await createServerInvite(request.params.serverId, request.user.id, request.body || {});
      return result.error ? response.status(result.code === "FORBIDDEN" ? 403 : 400).json(result) : response.status(201).json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.post("/api/servers/:serverId/invites/:inviteId/revoke", optionalAuth, requireAuth, async (request, response) => {
    if (!requireUuid(request.params.serverId, response) || !requireUuid(request.params.inviteId, response)) return;
    try {
      const result = await revokeServerInvite(request.params.serverId, request.params.inviteId, request.user.id);
      return result.error ? response.status(result.code === "FORBIDDEN" ? 403 : 404).json(result) : response.json(result);
    } catch (error) { return handleServerError(response, error); }
  });

  app.post("/api/server-invites/:code/join", optionalAuth, requireAuth, async (request, response) => {
    try {
      const result = await joinServerByInvite(request.params.code, request.user.id);
      return result.error ? response.status(400).json(result) : response.json(result);
    } catch (error) { return handleServerError(response, error); }
  });
}

export function attachServerSocket(io, socket) {
  socket.on("server:voice-join", async ({ serverId, channelId } = {}, ack) => {
    const acknowledge = typeof ack === "function" ? ack : () => {};
    const user = socket.data.accountUser;
    if (!user || !isUuid(serverId) || !isUuid(channelId)) return acknowledge({ ok: false, error: "Autenticacao necessaria." });
    const server = await getServerForUser(serverId, user.id).catch(() => null);
    const channel = server?.channels?.find((item) => item.id === channelId && item.type === "voice");
    if (!channel) return acknowledge({ ok: false, error: "Canal de voz indisponivel." });
    const previous = leaveServerVoice(socket, false);
    const key = serverVoiceKey(serverId, channelId);
    const session = serverVoiceSessions.get(key) || new Map();
    const participant = serverVoiceParticipant(socket);
    session.set(socket.id, participant);
    serverVoiceSessions.set(key, session);
    socketServerVoice.set(socket.id, key);
    socket.join(key);
    const participants = Array.from(session.values());
    socket.emit("server:voice-users", { serverId, channelId, channel: { id: channel.id, name: channel.name }, participants: participants.filter((item) => item.socketId !== socket.id) });
    socket.to(key).emit("server:voice-user-joined", { participant });
    acknowledge({ ok: true, key, participants });
    if (previous?.key && previous.key !== key) socket.emit("server:voice-left", { key: previous.key });
  });

  socket.on("server:voice-leave", (_payload, ack) => {
    const result = leaveServerVoice(socket);
    if (typeof ack === "function") ack({ ok: true, left: Boolean(result) });
    if (result) socket.emit("server:voice-left", { key: result.key });
  });

  socket.on("server:voice-media-status", ({ micEnabled, cameraEnabled, isScreenSharing } = {}) => {
    const key = getServerVoiceRoom(socket.id);
    const session = key && serverVoiceSessions.get(key);
    const participant = session?.get(socket.id);
    if (!participant) return;
    Object.assign(participant, { micEnabled: Boolean(micEnabled), cameraEnabled: Boolean(cameraEnabled), isScreenSharing: Boolean(isScreenSharing) });
    socket.to(key).emit("server:voice-media-status", { from: socket.id, ...participant });
  });

  socket.on("server:voice-speaking-state", ({ isSpeaking } = {}) => {
    const key = getServerVoiceRoom(socket.id);
    const session = key && serverVoiceSessions.get(key);
    const participant = session?.get(socket.id);
    if (!participant) return;
    participant.isSpeaking = Boolean(isSpeaking);
    socket.to(key).emit("server:voice-speaking-state", { from: socket.id, isSpeaking: participant.isSpeaking });
  });

  socket.on("disconnect", () => { leaveServerVoice(socket); });

  socket.on("server:subscribe", async ({ serverId, channelId } = {}, ack) => {
    const acknowledge = typeof ack === "function" ? ack : () => {};
    const user = socket.data.accountUser;
    if (!user || !isUuid(serverId) || !isUuid(channelId)) return acknowledge({ ok: false, error: "Autenticacao necessaria." });
    const server = await getServerForUser(serverId, user.id).catch(() => null);
    if (!server || !server.channels.some((channel) => channel.id === channelId && channel.type === "text")) return acknowledge({ ok: false, error: "Canal indisponivel." });
    socket.data.serverSubscriptions ||= new Set();
    for (const room of socket.data.serverSubscriptions) socket.leave(room);
    const room = `server:${serverId}:channel:${channelId}`;
    socket.data.serverSubscriptions.clear();
    socket.data.serverSubscriptions.add(room);
    socket.join(room);
    acknowledge({ ok: true, server });
  });

  socket.on("server:unsubscribe", ({ serverId, channelId } = {}) => {
    const room = `server:${serverId}:channel:${channelId}`;
    socket.leave(room);
    socket.data.serverSubscriptions?.delete(room);
  });

  socket.on("server:message", async ({ serverId, channelId, content, attachment, replyToMessageId } = {}, ack) => {
    const acknowledge = typeof ack === "function" ? ack : () => {};
    const user = socket.data.accountUser;
    if (!user || !isUuid(serverId) || !isUuid(channelId)) return acknowledge({ ok: false, error: "Autenticacao necessaria." });
    const message = await createServerMessage(serverId, channelId, user.id, { content, attachment, replyToMessageId }).catch(() => null);
    if (!message) return acknowledge({ ok: false, error: "Nao foi possivel enviar a mensagem." });
    io.to(`server:${serverId}:channel:${channelId}`).emit("server:message-created", message);
    acknowledge({ ok: true, message });
  });

  socket.on("server:typing", ({ serverId, channelId, typing } = {}) => {
    const user = socket.data.accountUser;
    if (!user || !isUuid(serverId) || !isUuid(channelId)) return;
    socket.to(`server:${serverId}:channel:${channelId}`).emit("server:typing", { serverId, channelId, userId: user.id, displayName: user.displayName || user.username, typing: Boolean(typing) });
  });

  socket.on("server:reaction", async ({ serverId, channelId, messageId, emoji } = {}, ack) => {
    const acknowledge = typeof ack === "function" ? ack : () => {};
    const user = socket.data.accountUser;
    if (!user || !isUuid(serverId) || !isUuid(channelId) || !isUuid(messageId)) return acknowledge({ ok: false, error: "Autenticacao necessaria." });
    const result = await toggleServerMessageReaction(serverId, channelId, messageId, user.id, emoji).catch(() => null);
    if (!result || result.error) return acknowledge({ ok: false, error: result?.error || "Nao foi possivel atualizar a reacao." });
    io.to(`server:${serverId}:channel:${channelId}`).emit("server:reaction-updated", result);
    acknowledge({ ok: true, ...result });
  });
}
