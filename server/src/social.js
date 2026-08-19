import {
  acceptFriendRequest,
  createFriendRequest,
  createMessage,
  deleteFriendRequest,
  ensureConversation,
  findRelationshipBetween,
  findSocialUserByUsername,
  getConversationForUser,
  getConversationUserIds,
  getSocialProfile,
  hideConversation,
  listConversations,
  listMessages,
  listRelationships,
  markConversationRead,
  removeFriendship,
  revealConversationForUsers
} from "./db/social.js";
import { getSessionTokenFromCookieHeader, optionalAuth, requireAuth } from "./auth.js";
import { findSessionUser } from "./db/sessions.js";
import { isDatabaseAvailable } from "./db/pool.js";

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOCIAL_USER_ROOM = "social:user:";
const socialIo = { current: null };
const onlineSockets = new Map();
const socialSubscribers = new Set();
const socialRateLog = new Map();
const typingRateLog = new Map();

function normalizeUsername(value) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

function publicSocialUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || "",
    accountType: user.accountType || "user",
    isOfficial: Boolean(user.isOfficial || user.accountType === "system"),
    badges: user.badges || []
  };
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ""));
}

function isRateLimited(key, limit, windowMs) {
  const now = Date.now();
  const current = socialRateLog.get(key) || { count: 0, resetAt: now + windowMs };
  if (now >= current.resetAt) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }
  current.count += 1;
  socialRateLog.set(key, current);
  return current.count > limit;
}

function onlineUserIds() {
  return new Set(Array.from(onlineSockets.entries()).filter(([, socketIds]) => socketIds.size > 0).map(([userId]) => userId));
}

function emitPresence(userId, status) {
  const io = socialIo.current;
  if (!io) return;
  for (const socketId of socialSubscribers) {
    io.to(socketId).emit("social:presence", { userId, status });
  }
}

function emitToSocialUser(userId, event, payload) {
  const io = socialIo.current;
  if (!io) return;
  io.to(`${SOCIAL_USER_ROOM}${userId}`).emit(event, payload);
}

function relationPayload(relation, onlineIds) {
  return {
    id: relation.id,
    status: relation.status,
    direction: relation.direction,
    createdAt: relation.createdAt,
    updatedAt: relation.updatedAt,
    user: {
      ...relation.user,
      status: onlineIds.has(relation.user.id) ? "online" : "offline"
    }
  };
}

async function socialSnapshot(userId) {
  const onlineIds = onlineUserIds();
  const relationships = await listRelationships(userId);
  return {
    friends: relationships.filter((item) => item.status === "accepted").map((item) => relationPayload(item, onlineIds)),
    receivedRequests: relationships.filter((item) => item.status === "pending" && item.direction === "received").map((item) => relationPayload(item, onlineIds)),
    sentRequests: relationships.filter((item) => item.status === "pending" && item.direction === "sent").map((item) => relationPayload(item, onlineIds)),
    onlineUserIds: Array.from(onlineIds)
  };
}

function handleSocialError(response, error) {
  console.error("[SOCIAL] request failed:", error.message);
  if (error?.code === "23505") {
    return response.status(409).json({ error: "Essa relacao ja existe.", code: "RELATION_EXISTS" });
  }
  return response.status(isDatabaseAvailable ? 500 : 503).json({ error: "Nao foi possivel concluir a operacao social." });
}

export function registerSocialRoutes(app) {
  app.get("/api/social/users/:userId/profile", optionalAuth, requireAuth, async (request, response) => {
    if (!isUuid(request.params.userId)) return response.status(400).json({ error: "Usuario invalido." });
    try {
      const profile = await getSocialProfile(request.params.userId, request.user.id);
      if (!profile) return response.status(404).json({ error: "Usuario nao encontrado." });
      const ids = onlineUserIds();
      profile.user.status = ids.has(profile.user.id) ? "online" : "offline";
      profile.activity.status = profile.user.status;
      profile.activity.kind = profile.user.status;
      return response.json(profile);
    } catch (error) {
      return handleSocialError(response, error);
    }
  });

  app.get("/api/social/friends", optionalAuth, requireAuth, async (request, response) => {
    try {
      return response.json(await socialSnapshot(request.user.id));
    } catch (error) {
      return handleSocialError(response, error);
    }
  });

  app.post("/api/social/friend-requests", optionalAuth, requireAuth, async (request, response) => {
    const username = normalizeUsername(request.body?.username);
    if (!USERNAME_PATTERN.test(username)) {
      return response.status(400).json({ error: "Informe um @username valido.", code: "INVALID_USERNAME" });
    }
    if (isRateLimited(`friend:${request.user.id}`, 20, 60 * 60 * 1000)) {
      return response.status(429).json({ error: "Muitos pedidos. Aguarde um pouco." });
    }

    try {
      const target = await findSocialUserByUsername(username);
      if (!target) return response.status(404).json({ error: "Nao encontramos esse usuario.", code: "USER_NOT_FOUND" });
      if (target.isOfficial) return response.status(404).json({ error: "Nao encontramos esse usuario.", code: "USER_NOT_FOUND" });
      if (target.id === request.user.id) return response.status(400).json({ error: "Voce nao pode adicionar a si mesmo.", code: "SELF_REQUEST" });
      const existing = await findRelationshipBetween(request.user.id, target.id);
      if (existing?.status === "accepted") return response.status(409).json({ error: "Voces ja sao amigos.", code: "ALREADY_FRIENDS" });
      if (existing?.status === "pending") return response.status(409).json({ error: "Ja existe um pedido pendente.", code: "REQUEST_EXISTS" });
      const relation = await createFriendRequest(request.user.id, target.id);
      emitToSocialUser(target.id, "social:friend-request", { relationId: relation.id });
      return response.status(201).json({ relation: relationPayload({ ...relation, user: target, direction: "sent" }, onlineUserIds()) });
    } catch (error) {
      return handleSocialError(response, error);
    }
  });

  app.post("/api/social/friend-requests/:id/accept", optionalAuth, requireAuth, async (request, response) => {
    if (!isUuid(request.params.id)) return response.status(400).json({ error: "Pedido invalido." });
    try {
      const relation = await acceptFriendRequest(request.params.id, request.user.id);
      if (!relation) return response.status(404).json({ error: "Pedido nao encontrado." });
      emitToSocialUser(relation.requester_user_id, "social:friend-updated", { relationId: relation.id });
      emitToSocialUser(relation.addressee_user_id, "social:friend-updated", { relationId: relation.id });
      return response.json({ ok: true });
    } catch (error) {
      return handleSocialError(response, error);
    }
  });

  app.delete("/api/social/friend-requests/:id", optionalAuth, requireAuth, async (request, response) => {
    if (!isUuid(request.params.id)) return response.status(400).json({ error: "Pedido invalido." });
    try {
      const relation = await deleteFriendRequest(request.params.id, request.user.id);
      if (!relation) return response.status(404).json({ error: "Pedido nao encontrado." });
      emitToSocialUser(relation.requester_user_id, "social:friend-updated", { relationId: relation.id });
      emitToSocialUser(relation.addressee_user_id, "social:friend-updated", { relationId: relation.id });
      return response.status(204).end();
    } catch (error) {
      return handleSocialError(response, error);
    }
  });

  app.delete("/api/social/friends/:userId", optionalAuth, requireAuth, async (request, response) => {
    if (!isUuid(request.params.userId) || request.params.userId === request.user.id) return response.status(400).json({ error: "Usuario invalido." });
    try {
      const relation = await removeFriendship(request.user.id, request.params.userId);
      if (!relation) return response.status(404).json({ error: "Amizade nao encontrada." });
      emitToSocialUser(relation.requester_user_id, "social:friend-updated", { relationId: relation.id });
      emitToSocialUser(relation.addressee_user_id, "social:friend-updated", { relationId: relation.id });
      return response.status(204).end();
    } catch (error) {
      return handleSocialError(response, error);
    }
  });

  app.get("/api/social/dms", optionalAuth, requireAuth, async (request, response) => {
    try {
      const conversations = await listConversations(request.user.id);
      return response.json({ conversations });
    } catch (error) {
      return handleSocialError(response, error);
    }
  });

  app.post("/api/social/dms/:conversationId/hide", optionalAuth, requireAuth, async (request, response) => {
    if (!isUuid(request.params.conversationId)) return response.status(400).json({ error: "Conversa invalida." });
    try {
      const hidden = await hideConversation(request.params.conversationId, request.user.id);
      if (!hidden) return response.status(404).json({ error: "Conversa nao encontrada." });
      return response.json({ ok: true });
    } catch (error) {
      return handleSocialError(response, error);
    }
  });

  app.post("/api/social/dms/:userId", optionalAuth, requireAuth, async (request, response) => {
    if (!isUuid(request.params.userId) || request.params.userId === request.user.id) return response.status(400).json({ error: "Usuario invalido." });
    try {
      const relation = await findRelationshipBetween(request.user.id, request.params.userId);
      if (relation?.status !== "accepted") return response.status(403).json({ error: "Adicione essa pessoa como amiga antes de iniciar uma DM." });
      const conversation = await ensureConversation(request.user.id, request.params.userId);
      const detail = await getConversationForUser(conversation.id, request.user.id);
      return response.status(201).json({ conversation: detail });
    } catch (error) {
      return handleSocialError(response, error);
    }
  });

  app.get("/api/social/dms/:conversationId/messages", optionalAuth, requireAuth, async (request, response) => {
    if (!isUuid(request.params.conversationId)) return response.status(400).json({ error: "Conversa invalida." });
    try {
      const result = await listMessages(request.params.conversationId, request.user.id, {
        before: String(request.query.before || ""),
        limit: request.query.limit
      });
      return response.json(result);
    } catch (error) {
      return handleSocialError(response, error);
    }
  });

  app.post("/api/social/dms/:conversationId/read", optionalAuth, requireAuth, async (request, response) => {
    if (!isUuid(request.params.conversationId)) return response.status(400).json({ error: "Conversa invalida." });
    try {
      const result = await markConversationRead(request.params.conversationId, request.user.id);
      if (!result) return response.status(404).json({ error: "Conversa nao encontrada." });
      return response.json({ ok: true, lastReadAt: result.last_read_at });
    } catch (error) {
      return handleSocialError(response, error);
    }
  });
}

export async function authenticateSocket(socket) {
  const token = getSessionTokenFromCookieHeader(socket.handshake.headers.cookie || "");
  if (!token) return null;
  try {
    return await findSessionUser(token);
  } catch (error) {
    console.warn("[AUTH] socket session lookup failed:", error.message);
    return null;
  }
}

export function configureSocialSocket(io) {
  socialIo.current = io;
}

export function registerAccountPresence(io, socket, user) {
  if (!user) return;
  socket.data.accountUser = user;
  const sockets = onlineSockets.get(user.id) || new Set();
  const wasOffline = sockets.size === 0;
  sockets.add(socket.id);
  onlineSockets.set(user.id, sockets);
  socket.data.presenceRegistered = true;
  if (wasOffline) emitPresence(user.id, "online");
}

export function unregisterAccountPresence(io, socket) {
  const user = socket.data.accountUser;
  if (!user || !socket.data.presenceRegistered) return;
  const sockets = onlineSockets.get(user.id);
  sockets?.delete(socket.id);
  if (!sockets?.size) {
    onlineSockets.delete(user.id);
    emitPresence(user.id, "offline");
  }
}

function rejectSocial(ack, message = "Autenticacao necessaria.") {
  ack?.({ ok: false, error: message, code: "UNAUTHENTICATED" });
}

export function attachSocialSocket(io, socket) {
  socket.on("social:subscribe", (ack) => {
    const acknowledge = typeof ack === "function" ? ack : null;
    if (!socket.data.accountUser) {
      rejectSocial(acknowledge);
      return;
    }
    socket.data.socialSubscribed = true;
    socialSubscribers.add(socket.id);
    socket.join(`${SOCIAL_USER_ROOM}${socket.data.accountUser.id}`);
    acknowledge?.({ ok: true, onlineUserIds: Array.from(onlineUserIds()) });
  });

  socket.on("dm:join", async ({ conversationId } = {}, ack) => {
    const acknowledge = typeof ack === "function" ? ack : null;
    const joinVersion = (socket.data.dmJoinVersion || 0) + 1;
    socket.data.dmJoinVersion = joinVersion;
    if (!socket.data.accountUser || !socket.data.socialSubscribed || !isUuid(conversationId)) {
      rejectSocial(acknowledge, "Conversa indisponivel.");
      return;
    }
    const conversation = await getConversationForUser(conversationId, socket.data.accountUser.id).catch(() => null);
    if (socket.data.dmJoinVersion !== joinVersion) {
      acknowledge?.({ ok: false, error: "A conversa foi atualizada.", code: "DM_JOIN_STALE" });
      return;
    }
    if (!conversation) {
      acknowledge?.({ ok: false, error: "Conversa nao encontrada.", code: "DM_NOT_FOUND" });
      return;
    }
    socket.data.dmConversations ||= new Set();
    socket.data.dmConversations.add(conversationId);
    socket.join(`dm:${conversationId}`);
    acknowledge?.({ ok: true, conversation });
  });

  socket.on("dm:leave", ({ conversationId } = {}) => {
    socket.data.dmJoinVersion = (socket.data.dmJoinVersion || 0) + 1;
    if (!isUuid(conversationId)) return;
    socket.data.dmConversations?.delete(conversationId);
    socket.leave(`dm:${conversationId}`);
  });

  socket.on("dm:message", async ({ conversationId, content, attachment } = {}, ack) => {
    const acknowledge = typeof ack === "function" ? ack : null;
    const user = socket.data.accountUser;
    const cleanContent = String(content || "").trim();
    if (!user || !socket.data.socialSubscribed || !isUuid(conversationId) || !cleanContent || cleanContent.length > 4000) {
      acknowledge?.({ ok: false, error: "A mensagem deve ter entre 1 e 4.000 caracteres.", code: "INVALID_MESSAGE" });
      return;
    }
    if (isRateLimited(`dm:${socket.id}`, 30, 60 * 1000)) {
      acknowledge?.({ ok: false, error: "Muitas mensagens. Aguarde um pouco.", code: "RATE_LIMITED" });
      return;
    }
    const conversation = await getConversationForUser(conversationId, user.id).catch(() => null);
    if (!conversation) {
      acknowledge?.({ ok: false, error: "Conversa nao encontrada.", code: "DM_NOT_FOUND" });
      return;
    }
    if (conversation.user?.isOfficial) {
      acknowledge?.({ ok: false, error: "Essa conversa oficial e somente leitura.", code: "OFFICIAL_DM_READ_ONLY" });
      return;
    }
    const safeAttachment = attachment && typeof attachment === "object" &&
      ["image", "video", "file"].includes(attachment.type) &&
      /^\/uploads\/[A-Za-z0-9._-]+$/.test(String(attachment.url || "")) &&
      Number.isInteger(attachment.size) && attachment.size <= 100 * 1024 * 1024
      ? {
          type: attachment.type,
          url: attachment.url,
          name: String(attachment.name || "arquivo").replace(/[\\/\0]/g, "").slice(0, 120),
          size: attachment.size,
          mimeType: String(attachment.mimeType || "application/octet-stream").slice(0, 120)
        }
      : null;
    if (attachment && !safeAttachment) {
      acknowledge?.({ ok: false, error: "Anexo invalido.", code: "INVALID_ATTACHMENT" });
      return;
    }
    const message = await createMessage(conversationId, user.id, cleanContent, safeAttachment).catch(() => null);
    if (!message) {
      acknowledge?.({ ok: false, error: "Nao foi possivel enviar a mensagem.", code: "MESSAGE_FAILED" });
      return;
    }
    const payload = {
      ...message,
      sender: publicSocialUser(user)
    };
    io.to(`dm:${conversationId}`).emit("dm:new-message", payload);
    const userIds = await getConversationUserIds(conversationId).catch(() => []);
    await revealConversationForUsers(conversationId, userIds).catch(() => {});
    for (const userId of userIds) {
      emitToSocialUser(userId, "social:conversation-updated", { conversationId, message: payload });
    }
    acknowledge?.({ ok: true, message: payload });
  });

  socket.on("dm:typing", async ({ conversationId, typing } = {}) => {
    const user = socket.data.accountUser;
    if (!user || !socket.data.socialSubscribed || !socket.data.dmConversations?.has(conversationId)) return;
    const key = `${socket.id}:${conversationId}`;
    const now = Date.now();
    if (typing && now - (typingRateLog.get(key) || 0) < 250) return;
    typingRateLog.set(key, now);
    socket.to(`dm:${conversationId}`).emit("dm:typing", {
      conversationId,
      userId: user.id,
      displayName: user.displayName || user.username,
      typing: Boolean(typing)
    });
  });

  socket.on("dm:read", async ({ conversationId } = {}, ack) => {
    const acknowledge = typeof ack === "function" ? ack : null;
    const user = socket.data.accountUser;
    if (!user || !socket.data.socialSubscribed || !isUuid(conversationId)) {
      rejectSocial(acknowledge, "Conversa indisponivel.");
      return;
    }
    const result = await markConversationRead(conversationId, user.id).catch(() => null);
    if (!result) {
      acknowledge?.({ ok: false, error: "Conversa nao encontrada." });
      return;
    }
    acknowledge?.({ ok: true, lastReadAt: result.last_read_at });
  });

  socket.on("disconnect", () => {
    socket.data.dmJoinVersion = (socket.data.dmJoinVersion || 0) + 1;
    socialSubscribers.delete(socket.id);
    for (const conversationId of socket.data.dmConversations || []) {
      typingRateLog.delete(`${socket.id}:${conversationId}`);
    }
    unregisterAccountPresence(io, socket);
  });
}

export { onlineUserIds };
