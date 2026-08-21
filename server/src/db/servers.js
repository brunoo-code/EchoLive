import crypto from "node:crypto";
import { query, withTransaction } from "./pool.js";

const SERVER_NAME_PATTERN = /^.{2,60}$/su;
const CHANNEL_NAME_PATTERN = /^.{1,40}$/su;
const SERVER_TYPES = new Set(["text", "voice"]);

function cleanName(value, pattern) {
  const name = String(value || "").trim();
  return pattern.test(name) ? name : null;
}

function cleanImageDataUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (source.length > 2_800_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(source)) return null;
  return source;
}

function mapChannel(row) {
  return { id: row.id, serverId: row.server_id, type: row.type, name: row.name, position: row.position, isDefault: Number(row.position) === 0 };
}

function mapServer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    iconUrl: row.icon_url || "",
    privacy: row.privacy,
    allowFriendJoin: row.allow_friend_join,
    role: row.role || null,
    memberCount: Number(row.member_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    channels: Array.isArray(row.channels) ? row.channels : []
  };
}

function mapMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    serverId: row.server_id,
    channelId: row.channel_id,
    content: row.deleted_at ? "" : row.content,
    attachment: row.deleted_at ? null : row.attachment,
    replyToMessageId: row.reply_to_message_id,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    reactions: Array.isArray(row.reactions) ? row.reactions : [],
    sender: {
      id: row.sender_user_id,
      username: row.username,
      displayName: row.server_nickname || row.display_name,
      globalDisplayName: row.display_name,
      serverNickname: row.server_nickname || "",
      avatarUrl: row.avatar_url || "",
      pronouns: row.pronouns || "",
      aboutMe: row.about_me || "",
      accentColor: row.accent_color || "#22D3EE",
      customStatus: row.custom_status || "",
      status: row.presence_status || "online",
      badges: Array.isArray(row.badges) ? row.badges : []
    }
  };
}

function mapInvite(row) {
  if (!row) return null;
  return { id: row.id, serverId: row.server_id, code: row.code, maxUses: row.max_uses, uses: row.uses, expiresAt: row.expires_at, revokedAt: row.revoked_at, createdAt: row.created_at };
}

function safeAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") return null;
  if (!["image", "video", "file"].includes(attachment.type)) return null;
  if (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(String(attachment.url || ""))) return null;
  if (!Number.isInteger(attachment.size) || attachment.size < 0 || attachment.size > 100 * 1024 * 1024) return null;
  return {
    type: attachment.type,
    url: attachment.url,
    name: String(attachment.name || "arquivo").replace(/[\\/\0]/g, "").slice(0, 120),
    size: attachment.size,
    mimeType: String(attachment.mimeType || "application/octet-stream").slice(0, 120)
  };
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export function validateServerInput({ name, privacy = "private", allowFriendJoin = true }) {
  const cleanNameValue = cleanName(name, SERVER_NAME_PATTERN);
  if (!cleanNameValue) return { error: "O nome do servidor deve ter entre 2 e 60 caracteres." };
  if (!["private", "public"].includes(privacy)) return { error: "Privacidade de servidor invalida." };
  return { value: { name: cleanNameValue, privacy, allowFriendJoin: Boolean(allowFriendJoin) } };
}

export function validateChannelInput({ name, type = "text" }) {
  const cleanChannelName = cleanName(name, CHANNEL_NAME_PATTERN);
  if (!cleanChannelName) return { error: "O nome do canal deve ter entre 1 e 40 caracteres." };
  if (!SERVER_TYPES.has(type)) return { error: "Tipo de canal invalido." };
  return { value: { name: cleanChannelName, type } };
}

export async function listServersForUser(userId) {
  const result = await query(
    `SELECT s.*, m.role,
            (SELECT COUNT(*)::int FROM server_members sm2 WHERE sm2.server_id = s.id) AS member_count,
            COALESCE((SELECT json_agg(json_build_object('id', c.id, 'serverId', c.server_id, 'type', c.type, 'name', c.name, 'position', c.position, 'isDefault', c.position = 0) ORDER BY c.type, c.position, c.created_at)
                      FROM server_channels c WHERE c.server_id = s.id), '[]'::json) AS channels
     FROM servers s
     JOIN server_members m ON m.server_id = s.id AND m.user_id = $1
     WHERE s.deleted_at IS NULL
     ORDER BY s.updated_at DESC, s.created_at DESC`,
    [userId]
  );
  return result.rows.map(mapServer);
}

export async function getServerForUser(serverId, userId) {
  const result = await query(
    `SELECT s.*, m.role,
            (SELECT COUNT(*)::int FROM server_members sm2 WHERE sm2.server_id = s.id) AS member_count,
            COALESCE((SELECT json_agg(json_build_object('id', c.id, 'serverId', c.server_id, 'type', c.type, 'name', c.name, 'position', c.position, 'isDefault', c.position = 0) ORDER BY c.type, c.position, c.created_at)
                      FROM server_channels c WHERE c.server_id = s.id), '[]'::json) AS channels
     FROM servers s
     JOIN server_members m ON m.server_id = s.id AND m.user_id = $2
     WHERE s.id = $1 AND s.deleted_at IS NULL
     LIMIT 1`,
    [serverId, userId]
  );
  return mapServer(result.rows[0]);
}

export async function listServerMembers(serverId, userId) {
  const server = await getServerForUser(serverId, userId);
  if (!server) return null;
  const result = await query(
    `SELECT sm.role, sm.joined_at, sm.nickname AS server_nickname,
            u.id, u.username, u.display_name, u.avatar_url, u.pronouns, u.about_me,
            u.accent_color, u.custom_status, u.presence_status,
            COALESCE((SELECT json_agg(json_build_object('code', b.code, 'label', b.label, 'iconKey', b.icon_key) ORDER BY ub.granted_at DESC)
                      FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = u.id), '[]'::json) AS badges
     FROM server_members sm JOIN users u ON u.id = sm.user_id
     WHERE sm.server_id = $1
     ORDER BY CASE sm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.display_name, u.username`,
    [serverId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.server_nickname || row.display_name,
    globalDisplayName: row.display_name,
    serverNickname: row.server_nickname || "",
    avatarUrl: row.avatar_url || "",
    pronouns: row.pronouns || "",
    aboutMe: row.about_me || "",
    accentColor: row.accent_color || "#22D3EE",
    customStatus: row.custom_status || "",
    status: row.presence_status || "online",
    badges: Array.isArray(row.badges) ? row.badges : [],
    role: row.role,
    joinedAt: row.joined_at
  }));
}

export async function joinServerForUser(serverId, userId) {
  const result = await query(
    `SELECT s.id, s.privacy, s.allow_friend_join,
            EXISTS (
              SELECT 1 FROM friendships f
              JOIN server_members friend_member ON friend_member.user_id = CASE
                WHEN f.requester_user_id = $2 THEN f.addressee_user_id ELSE f.requester_user_id END
              WHERE f.status = 'accepted'
                AND (f.requester_user_id = $2 OR f.addressee_user_id = $2)
                AND friend_member.server_id = s.id
            ) AS has_friend
     FROM servers s
     WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [serverId, userId]
  );
  const server = result.rows[0];
  if (!server) return { error: "Servidor nao encontrado.", code: "NOT_FOUND" };
  if (server.privacy !== "public" && !(server.allow_friend_join && server.has_friend)) return { error: "Este servidor exige um convite.", code: "INVITE_REQUIRED" };
  await query("INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT (server_id, user_id) DO NOTHING", [serverId, userId]);
  return { server: await getServerForUser(serverId, userId) };
}

export async function createServer(userId, input) {
  const validation = validateServerInput(input || {});
  if (validation.error) return { error: validation.error };
  const iconUrl = cleanImageDataUrl(input?.iconUrl);
  if (iconUrl === null) return { error: "Use uma imagem PNG, JPEG ou WebP de ate 2 MB.", code: "INVALID_SERVER_ICON" };
  const server = await withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO servers (name, owner_user_id, privacy, allow_friend_join, icon_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [validation.value.name, userId, validation.value.privacy, validation.value.allowFriendJoin, iconUrl]
    );
    const serverId = inserted.rows[0].id;
    await client.query("INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'owner')", [serverId, userId]);
    await client.query(
      `INSERT INTO server_channels (server_id, type, name, position)
       VALUES ($1, 'text', 'geral', 0), ($1, 'voice', 'Geral', 0)`,
      [serverId]
    );
    return serverId;
  });
  return { server: await getServerForUser(server, userId) };
}

export async function updateServer(serverId, userId, input) {
  const current = await getServerForUser(serverId, userId);
  if (!current || !["owner", "admin"].includes(current.role)) return { error: "Sem permissao para editar este servidor.", code: "FORBIDDEN" };
  const name = input?.name === undefined ? current.name : cleanName(input.name, SERVER_NAME_PATTERN);
  if (!name) return { error: "O nome do servidor deve ter entre 2 e 60 caracteres." };
  const privacy = input?.privacy === undefined ? current.privacy : input.privacy;
  if (!["private", "public"].includes(privacy)) return { error: "Privacidade de servidor invalida." };
  const allowFriendJoin = input?.allowFriendJoin === undefined ? current.allowFriendJoin : Boolean(input.allowFriendJoin);
  const iconUrl = input?.iconUrl === undefined ? current.iconUrl : cleanImageDataUrl(input.iconUrl);
  if (iconUrl === null) return { error: "Use uma imagem PNG, JPEG ou WebP de ate 2 MB.", code: "INVALID_SERVER_ICON" };
  await query("UPDATE servers SET name = $1, privacy = $2, allow_friend_join = $3, icon_url = $4, updated_at = NOW() WHERE id = $5", [name, privacy, allowFriendJoin, iconUrl, serverId]);
  return { server: await getServerForUser(serverId, userId) };
}

export async function updateServerNickname(serverId, userId, value) {
  const current = await getServerForUser(serverId, userId);
  if (!current) return { error: "Servidor nao encontrado.", code: "NOT_FOUND" };
  const nickname = String(value || "").trim();
  if (nickname.length > 40) return { error: "O apelido deve ter no maximo 40 caracteres." };
  await query("UPDATE server_members SET nickname = $3 WHERE server_id = $1 AND user_id = $2", [serverId, userId, nickname || null]);
  return { member: (await listServerMembers(serverId, userId)).find((member) => member.id === userId) || null };
}

export async function deleteServer(serverId, userId) {
  const current = await getServerForUser(serverId, userId);
  if (!current || current.role !== "owner") return { error: "Somente o proprietario pode apagar o servidor.", code: "FORBIDDEN" };
  await withTransaction(async (client) => {
    await client.query("DELETE FROM servers WHERE id = $1 AND owner_user_id = $2", [serverId, userId]);
  });
  return { ok: true };
}

export async function leaveServer(serverId, userId) {
  const current = await getServerForUser(serverId, userId);
  if (!current) return { error: "Servidor nao encontrado.", code: "NOT_FOUND" };
  if (current.role === "owner") return { error: "O proprietario deve transferir o servidor antes de sair.", code: "OWNER_CANNOT_LEAVE" };
  await query("DELETE FROM server_members WHERE server_id = $1 AND user_id = $2", [serverId, userId]);
  return { ok: true };
}

export async function createChannel(serverId, userId, input) {
  const current = await getServerForUser(serverId, userId);
  if (!current || !["owner", "admin"].includes(current.role)) return { error: "Sem permissao para criar canais.", code: "FORBIDDEN" };
  const validation = validateChannelInput(input || {});
  if (validation.error) return { error: validation.error };
  try {
    const result = await query("INSERT INTO server_channels (server_id, type, name, position) VALUES ($1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM server_channels WHERE server_id = $1 AND type = $2), 0)) RETURNING *", [serverId, validation.value.type, validation.value.name]);
    return { channel: mapChannel(result.rows[0]) };
  } catch (error) {
    if (error.code === "23505") return { error: "Ja existe um canal com esse nome.", code: "CHANNEL_EXISTS" };
    throw error;
  }
}

export async function updateChannel(serverId, channelId, userId, input) {
  const current = await getServerForUser(serverId, userId);
  if (!current || !["owner", "admin"].includes(current.role)) return { error: "Sem permissao para editar canais.", code: "FORBIDDEN" };
  const name = cleanName(input?.name, CHANNEL_NAME_PATTERN);
  if (!name) return { error: "O nome do canal deve ter entre 1 e 40 caracteres." };
  try {
    const result = await query("UPDATE server_channels SET name = $1 WHERE id = $2 AND server_id = $3 RETURNING *", [name, channelId, serverId]);
    return result.rows[0] ? { channel: mapChannel(result.rows[0]) } : { error: "Canal nao encontrado.", code: "NOT_FOUND" };
  } catch (error) {
    if (error.code === "23505") return { error: "Ja existe um canal com esse nome.", code: "CHANNEL_EXISTS" };
    throw error;
  }
}

export async function deleteChannel(serverId, channelId, userId) {
  const current = await getServerForUser(serverId, userId);
  if (!current || !["owner", "admin"].includes(current.role)) return { error: "Sem permissao para apagar canais.", code: "FORBIDDEN" };
  return withTransaction(async (client) => {
    const existing = await client.query("SELECT id, position FROM server_channels WHERE id = $1 AND server_id = $2 FOR UPDATE", [channelId, serverId]);
    if (!existing.rows[0]) return { error: "Canal nao encontrado.", code: "NOT_FOUND" };
    if (Number(existing.rows[0].position) === 0) return { error: "O canal padrao nao pode ser excluido.", code: "PROTECTED_CHANNEL" };
    await client.query("DELETE FROM server_channels WHERE id = $1 AND server_id = $2", [channelId, serverId]);
    return { ok: true };
  });
}

export async function listServerMessages(serverId, channelId, userId, { limit = 50, before = "" } = {}) {
  const server = await getServerForUser(serverId, userId);
  if (!server) return null;
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const cursor = isUuid(before) ? before : "";
  const result = await query(
    `SELECT m.*, u.username, u.display_name, u.avatar_url, u.pronouns, u.about_me,
            u.accent_color, u.custom_status, u.presence_status,
            membership.nickname AS server_nickname,
            COALESCE((SELECT json_agg(json_build_object('code', b.code, 'label', b.label, 'iconKey', b.icon_key) ORDER BY ub.granted_at DESC)
                      FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = u.id), '[]'::json) AS badges,
            COALESCE((SELECT json_agg(json_build_object('emoji', reaction_rows.emoji, 'count', reaction_rows.reaction_count, 'reacted', reaction_rows.reacted) ORDER BY reaction_rows.emoji)
                      FROM (SELECT smr.emoji, COUNT(*)::int AS reaction_count, BOOL_OR(smr.user_id = $3::uuid) AS reacted
                            FROM server_message_reactions smr WHERE smr.message_id = m.id GROUP BY smr.emoji) reaction_rows), '[]'::json) AS reactions
     FROM server_messages m
     JOIN users u ON u.id = m.sender_user_id
     LEFT JOIN server_members membership ON membership.server_id = m.server_id AND membership.user_id = u.id
     WHERE m.server_id = $1 AND m.channel_id = $2
       AND ($4 = '' OR (m.created_at, m.id) < (SELECT created_at, id FROM server_messages WHERE id = $4::uuid))
     ORDER BY m.created_at DESC, m.id DESC LIMIT $5`,
    [serverId, channelId, userId, cursor, safeLimit]
  );
  const messages = result.rows.map(mapMessage).reverse();
  return { messages, hasMore: result.rows.length === safeLimit };
}

export async function toggleServerMessageReaction(serverId, channelId, messageId, userId, value) {
  const server = await getServerForUser(serverId, userId);
  if (!server) return null;
  const emoji = String(value || "").trim();
  if (!emoji || emoji.length > 16 || /\s/u.test(emoji)) return { error: "Reacao invalida." };
  const existing = await query("SELECT 1 FROM server_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3", [messageId, userId, emoji]);
  if (existing.rowCount) {
    await query("DELETE FROM server_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3", [messageId, userId, emoji]);
    return { messageId, emoji, active: false };
  }
  const validMessage = await query("SELECT 1 FROM server_messages WHERE id = $1 AND server_id = $2 AND channel_id = $3 AND deleted_at IS NULL", [messageId, serverId, channelId]);
  if (!validMessage.rowCount) return { error: "Mensagem nao encontrada.", code: "NOT_FOUND" };
  await query("INSERT INTO server_message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [messageId, userId, emoji]);
  return { messageId, emoji, active: true };
}

export async function createServerMessage(serverId, channelId, userId, { content = "", attachment = null, replyToMessageId = null } = {}) {
  const server = await getServerForUser(serverId, userId);
  if (!server || !server.channels.some((channel) => channel.id === channelId && channel.type === "text")) return null;
  const cleanContent = String(content || "").trim();
  const cleanAttachment = safeAttachment(attachment);
  if (cleanContent.length > 4000 || (!cleanContent && !cleanAttachment) || (attachment && !cleanAttachment)) return null;
  const result = await query(
    `INSERT INTO server_messages (server_id, channel_id, sender_user_id, content, attachment, reply_to_message_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
    [serverId, channelId, userId, cleanContent, cleanAttachment ? JSON.stringify(cleanAttachment) : null, isUuid(replyToMessageId) ? replyToMessageId : null]
  );
  const listed = await listServerMessages(serverId, channelId, userId, { limit: 1, before: "" });
  return listed?.messages.find((message) => message.id === result.rows[0].id) || null;
}

export async function editServerMessage(serverId, channelId, messageId, userId, content) {
  const server = await getServerForUser(serverId, userId);
  if (!server) return { error: "Servidor nao encontrado.", code: "NOT_FOUND" };
  const cleanContent = String(content || "").trim();
  if (!cleanContent || cleanContent.length > 4000) return { error: "A mensagem deve ter entre 1 e 4.000 caracteres." };
  const result = await query("UPDATE server_messages SET content = $1, edited_at = NOW() WHERE id = $2 AND server_id = $3 AND channel_id = $4 AND sender_user_id = $5 AND deleted_at IS NULL RETURNING id", [cleanContent, messageId, serverId, channelId, userId]);
  if (!result.rows[0]) return { error: "Mensagem nao encontrada ou sem permissao.", code: "FORBIDDEN" };
  const listed = await listServerMessages(serverId, channelId, userId, { limit: 100 });
  return { message: listed.messages.find((message) => message.id === messageId) || null };
}

export async function deleteServerMessage(serverId, channelId, messageId, userId) {
  const server = await getServerForUser(serverId, userId);
  if (!server) return { error: "Servidor nao encontrado.", code: "NOT_FOUND" };
  const result = await query("UPDATE server_messages SET content = '', attachment = NULL, deleted_at = NOW() WHERE id = $1 AND server_id = $2 AND channel_id = $3 AND sender_user_id = $4 AND deleted_at IS NULL RETURNING id", [messageId, serverId, channelId, userId]);
  return result.rows[0] ? { ok: true, messageId } : { error: "Mensagem nao encontrada ou sem permissao.", code: "FORBIDDEN" };
}

export async function createServerInvite(serverId, userId, { maxUses = null, expiresAt = null } = {}) {
  const server = await getServerForUser(serverId, userId);
  if (!server || !["owner", "admin"].includes(server.role)) return { error: "Sem permissao para criar convites.", code: "FORBIDDEN" };
  const safeMaxUses = maxUses === null || maxUses === undefined || maxUses === "" ? null : Math.max(1, Math.min(1000, Number(maxUses) || 1));
  const code = crypto.randomBytes(5).toString("base64url").slice(0, 8).toUpperCase();
  const result = await query("INSERT INTO server_invites (server_id, code, created_by_user_id, max_uses, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *", [serverId, code, userId, safeMaxUses, expiresAt || null]);
  return { invite: mapInvite(result.rows[0]) };
}

export async function revokeServerInvite(serverId, inviteId, userId) {
  const server = await getServerForUser(serverId, userId);
  if (!server || !["owner", "admin"].includes(server.role)) return { error: "Sem permissao para revogar convites.", code: "FORBIDDEN" };
  const result = await query("UPDATE server_invites SET revoked_at = NOW() WHERE id = $1 AND server_id = $2 AND revoked_at IS NULL RETURNING id", [inviteId, serverId]);
  return result.rows[0] ? { ok: true } : { error: "Convite nao encontrado.", code: "NOT_FOUND" };
}

export async function joinServerByInvite(code, userId) {
  const result = await withTransaction(async (client) => {
    const inviteResult = await client.query("SELECT * FROM server_invites WHERE code = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE", [String(code || "").trim().toUpperCase()]);
    const invite = inviteResult.rows[0];
    if (!invite || (invite.max_uses !== null && invite.uses >= invite.max_uses)) return { error: "Convite invalido ou expirado.", code: "INVALID_INVITE" };
    await client.query("INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT (server_id, user_id) DO NOTHING", [invite.server_id, userId]);
    await client.query("UPDATE server_invites SET uses = uses + 1 WHERE id = $1", [invite.id]);
    return { serverId: invite.server_id };
  });
  if (result.error) return result;
  return { server: await getServerForUser(result.serverId, userId) };
}
