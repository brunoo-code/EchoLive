import { query, withTransaction } from "./pool.js";
import { listMutualRooms } from "./roomActivity.js";

function mapSocialUser(row) {
  if (!row) return null;
  const badges = Array.isArray(row.badges) ? row.badges : [];
  const accountType = row.account_type || "user";
  return {
    id: row.user_id || row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || "",
    accountType,
    isOfficial: accountType === "system",
    badges
  };
}

function orderPair(left, right) {
  return String(left) < String(right) ? [left, right] : [right, left];
}

export async function findSocialUserByUsername(usernameNormalized) {
  const result = await query(
    `SELECT id AS user_id, username, display_name, avatar_url, account_type,
            COALESCE((SELECT json_agg(json_build_object('code', b.code, 'label', b.label, 'iconKey', b.icon_key)
                      ORDER BY ub.granted_at DESC)
                      FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
                      WHERE ub.user_id = users.id), '[]'::json) AS badges
     FROM users
     WHERE username_normalized = $1
     LIMIT 1`,
    [usernameNormalized]
  );
  return mapSocialUser(result.rows[0]);
}

export async function listRelationships(userId) {
  const result = await query(
    `SELECT f.id, f.status, f.requester_user_id, f.addressee_user_id, f.created_at, f.updated_at,
            u.id AS user_id, u.username, u.display_name, u.avatar_url, u.account_type,
            COALESCE((SELECT json_agg(json_build_object('code', b.code, 'label', b.label, 'iconKey', b.icon_key)
                      ORDER BY ub.granted_at DESC)
                      FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
                      WHERE ub.user_id = u.id), '[]'::json) AS badges
     FROM friendships f
     JOIN users u ON u.id = CASE
       WHEN f.requester_user_id = $1 THEN f.addressee_user_id
       ELSE f.requester_user_id
     END
     WHERE f.requester_user_id = $1 OR f.addressee_user_id = $1
     ORDER BY f.updated_at DESC, f.id DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    direction: row.requester_user_id === userId ? "sent" : "received",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: mapSocialUser(row)
  }));
}

export async function findRelationshipBetween(userId, otherUserId) {
  const result = await query(
    `SELECT id, status, requester_user_id, addressee_user_id
     FROM friendships
     WHERE (requester_user_id = $1 AND addressee_user_id = $2)
        OR (requester_user_id = $2 AND addressee_user_id = $1)
     LIMIT 1`,
    [userId, otherUserId]
  );
  return result.rows[0] || null;
}

export async function getSocialProfile(userId, viewerId) {
  const userResult = await query(
    `SELECT u.id AS user_id, u.username, u.display_name, u.avatar_url, u.account_type,
            COALESCE((SELECT json_agg(json_build_object('code', b.code, 'label', b.label, 'iconKey', b.icon_key)
                      ORDER BY ub.granted_at DESC)
                      FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
                      WHERE ub.user_id = u.id), '[]'::json) AS badges
       FROM users u WHERE u.id = $1 LIMIT 1`,
    [userId]
  );
  const user = mapSocialUser(userResult.rows[0]);
  if (!user) return null;
  const relationship = viewerId === userId ? null : await findRelationshipBetween(viewerId, userId);
  const mutualResult = viewerId === userId ? { rows: [] } : await query(
    `SELECT u.id AS user_id, u.username, u.display_name, u.avatar_url, u.account_type,
            COALESCE((SELECT json_agg(json_build_object('code', b.code, 'label', b.label, 'iconKey', b.icon_key)
                      ORDER BY ub.granted_at DESC)
                      FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
                      WHERE ub.user_id = u.id), '[]'::json) AS badges
       FROM users u
       JOIN friendships f1 ON f1.status = 'accepted'
         AND ((f1.requester_user_id = $1 AND f1.addressee_user_id = u.id)
           OR (f1.addressee_user_id = $1 AND f1.requester_user_id = u.id))
       JOIN friendships f2 ON f2.status = 'accepted'
         AND ((f2.requester_user_id = $2 AND f2.addressee_user_id = u.id)
           OR (f2.addressee_user_id = $2 AND f2.requester_user_id = u.id))
       WHERE u.id NOT IN ($1, $2)
       ORDER BY u.display_name, u.username
       LIMIT 20`,
    [viewerId, userId]
  );
  const mutualRooms = viewerId === userId ? [] : await listMutualRooms(viewerId, userId).catch(() => []);
  return {
    user,
    relationship: relationship ? { status: relationship.status, direction: relationship.requester_user_id === viewerId ? "sent" : "received" } : null,
    mutualFriends: mutualResult.rows.map(mapSocialUser),
    mutualRooms,
    activity: { status: "offline", kind: "offline", room: null }
  };
}

export async function createFriendRequest(requesterUserId, addresseeUserId) {
  const result = await query(
    `INSERT INTO friendships (requester_user_id, addressee_user_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING id, status, requester_user_id, addressee_user_id, created_at, updated_at`,
    [requesterUserId, addresseeUserId]
  );
  return result.rows[0];
}

export async function acceptFriendRequest(requestId, addresseeUserId) {
  const result = await query(
    `UPDATE friendships
     SET status = 'accepted', updated_at = NOW()
     WHERE id = $1 AND addressee_user_id = $2 AND status = 'pending'
     RETURNING id, status, requester_user_id, addressee_user_id, updated_at`,
    [requestId, addresseeUserId]
  );
  return result.rows[0] || null;
}

export async function deleteFriendRequest(requestId, userId) {
  const result = await query(
    `DELETE FROM friendships
     WHERE id = $1
       AND status = 'pending'
       AND (requester_user_id = $2 OR addressee_user_id = $2)
     RETURNING id, requester_user_id, addressee_user_id`,
    [requestId, userId]
  );
  return result.rows[0] || null;
}

export async function removeFriendship(userId, otherUserId) {
  const result = await query(
    `DELETE FROM friendships
     WHERE status = 'accepted'
       AND ((requester_user_id = $1 AND addressee_user_id = $2)
         OR (requester_user_id = $2 AND addressee_user_id = $1))
     RETURNING id, requester_user_id, addressee_user_id`,
    [userId, otherUserId]
  );
  return result.rows[0] || null;
}

export async function ensureConversation(userId, otherUserId) {
  const [userOneId, userTwoId] = orderPair(userId, otherUserId);
  return withTransaction(async (client) => {
    const conversationResult = await client.query(
      `INSERT INTO dm_conversations (user_one_id, user_two_id)
       VALUES ($1, $2)
       ON CONFLICT (user_one_id, user_two_id)
       DO UPDATE SET updated_at = dm_conversations.updated_at
       RETURNING id, user_one_id, user_two_id, created_at, updated_at`,
      [userOneId, userTwoId]
    );
    const conversation = conversationResult.rows[0];
    await client.query(
      `INSERT INTO dm_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conversation.id, userOneId, userTwoId]
    );
    return conversation;
  });
}

export async function hideConversation(conversationId, userId) {
  const result = await query(
    `UPDATE dm_participants SET hidden_at = NOW()
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING conversation_id`,
    [conversationId, userId]
  );
  return Boolean(result.rowCount);
}

export async function revealConversationForUsers(conversationId, userIds) {
  if (!userIds?.length) return;
  await query(
    `UPDATE dm_participants SET hidden_at = NULL
     WHERE conversation_id = $1 AND user_id = ANY($2::uuid[])`,
    [conversationId, userIds]
  );
}

export async function ensureOfficialIdentity() {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('echolive.system.identity'))");
    const existing = await client.query(
      `SELECT id, username, display_name, avatar_url, account_type, system_key
       FROM users WHERE system_key = 'echolive_official' LIMIT 1`
    );
    if (existing.rows[0]) return existing.rows[0];

    const candidates = [
      ["system_echolive", "system_echolive"],
      ["echolive_oficial", "echolive_oficial"],
      ["echolive_system", "echolive_system"],
      ["echolive_ekobot", "echolive_ekobot"]
    ];
    let selected = null;
    for (const [username, normalized] of candidates) {
      const collision = await client.query(
        "SELECT 1 FROM users WHERE username_normalized = $1 LIMIT 1",
        [normalized]
      );
      if (!collision.rowCount) {
        selected = { username, normalized };
        break;
      }
    }
    if (!selected) {
      for (let suffix = 1; suffix < 1000; suffix += 1) {
        const username = `echolive_system_${suffix}`;
        const collision = await client.query(
          "SELECT 1 FROM users WHERE username_normalized = $1 LIMIT 1",
          [username]
        );
        if (!collision.rowCount) {
          selected = { username, normalized: username };
          break;
        }
      }
    }
    if (!selected) throw new Error("OFFICIAL_IDENTITY_UNAVAILABLE");
    const result = await client.query(
      `INSERT INTO users (username, username_normalized, display_name, password_hash, account_type, system_key)
       VALUES ($1, $2, 'EchoLive', '!system-account', 'system', 'echolive_official')
       RETURNING id, username, display_name, avatar_url, account_type, system_key`,
      [selected.username, selected.normalized]
    );
    return result.rows[0];
  });
}

async function grantBetaBadge(userId) {
  await query(
    `INSERT INTO user_badges (user_id, badge_id)
     SELECT $1, id FROM badges WHERE code = 'echolive_beta'
     ON CONFLICT (user_id, badge_id) DO NOTHING`,
    [userId]
  );
}

async function seedOfficialMessages(conversationId, displayName) {
  const messages = [
    ["welcome", `Oi, ${displayName || "por aqui"}! 👋\nEu sou o Eko. Bem-vindo ao EchoLive.`],
    ["quick_room", "Quer conversar agora?\nCrie uma Sala Rápida e compartilhe o convite."],
    ["servers", "Quer um espaço permanente?\nServidores mantêm canais, membros e mensagens."],
    ["friends", "Encontre seus amigos.\nAdicione pessoas, converse por DM e veja quem está online."],
    ["ready", "Pronto. Esse espaço é seu. ✨\nUse Sala Rápida para algo imediato ou Servidor para ficar."]
  ];
  await query(
    `DELETE FROM dm_messages legacy
     WHERE legacy.conversation_id = $1
       AND legacy.official_key = 'quick-room'
       AND EXISTS (
         SELECT 1 FROM dm_messages canonical
         WHERE canonical.conversation_id = legacy.conversation_id
           AND canonical.official_key = 'quick_room'
       )`,
    [conversationId]
  );
  await query(
    `UPDATE dm_messages
     SET official_key = 'quick_room'
     WHERE conversation_id = $1
       AND official_key = 'quick-room'
       AND NOT EXISTS (
         SELECT 1 FROM dm_messages canonical
         WHERE canonical.conversation_id = $1
           AND canonical.official_key = 'quick_room'
       )`,
    [conversationId]
  );
  for (const [officialKey, content] of messages) {
    await query(
      `INSERT INTO dm_messages (conversation_id, sender_user_id, content, message_type, official_key)
       SELECT $1, u.id, $2, 'official', $3
       FROM users u
       WHERE u.system_key = 'echolive_official'
       ON CONFLICT (conversation_id, official_key) WHERE official_key IS NOT NULL
       DO UPDATE SET
         sender_user_id = EXCLUDED.sender_user_id,
         content = EXCLUDED.content,
         message_type = 'official',
         attachment = NULL`,
      [conversationId, content, officialKey]
    );
  }
}

async function listOfficialMessageKeys(conversationId) {
  const result = await query(
    `SELECT official_key
       FROM dm_messages
      WHERE conversation_id = $1
        AND message_type = 'official'
        AND official_key IS NOT NULL
      ORDER BY created_at, id`,
    [conversationId]
  );
  return result.rows.map((row) => row.official_key);
}

async function ensureOfficialConversationBootstrap(conversationId, userId) {
  const result = await query(
    `SELECT c.id
     FROM dm_conversations c
     JOIN dm_participants p ON p.conversation_id = c.id AND p.user_id = $2
     JOIN users other ON other.id = CASE WHEN c.user_one_id = $2 THEN c.user_two_id ELSE c.user_one_id END
     WHERE c.id = $1 AND other.account_type = 'system'
     LIMIT 1`,
    [conversationId, userId]
  );
  if (!result.rows[0]) return false;
  await ensureAccountSocialBootstrap(userId);
  return true;
}

export async function ensureAccountSocialBootstrap(userId) {
  const official = await ensureOfficialIdentity();
  const conversation = await ensureConversation(userId, official.id);
  await query(
    "UPDATE dm_participants SET hidden_at = NULL WHERE conversation_id = $1 AND user_id = $2",
    [conversation.id, userId]
  );
  await grantBetaBadge(userId).catch((error) => {
    console.error("[OFFICIAL:badge] bootstrap skipped:", error.message);
  });
  const userResult = await query("SELECT display_name FROM users WHERE id = $1 LIMIT 1", [userId]);
  await seedOfficialMessages(conversation.id, userResult.rows[0]?.display_name);
  const officialKeys = await listOfficialMessageKeys(conversation.id);
  const expectedKeys = ["welcome", "quick_room", "servers", "friends", "ready"];
  if (!expectedKeys.every((key) => officialKeys.includes(key))) {
    throw new Error("OFFICIAL_BOOTSTRAP_INCOMPLETE");
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug("[OFFICIAL:onboarding]", {
      userId,
      conversationId: conversation.id,
      count: officialKeys.length,
      keys: officialKeys
    });
    console.debug("[OFFICIAL:ensure]", { userId, conversationId: conversation.id, status: "ready" });
  }
  return conversation;
}

export async function getConversationForUser(conversationId, userId) {
  const result = await query(
    `SELECT c.id, c.user_one_id, c.user_two_id, c.created_at, c.updated_at,
            other.id AS other_user_id, other.username AS other_username,
            other.display_name AS other_display_name, other.avatar_url AS other_avatar_url,
            other.account_type AS other_account_type,
            COALESCE((SELECT json_agg(json_build_object('code', b.code, 'label', b.label, 'iconKey', b.icon_key)
                      ORDER BY ub.granted_at DESC)
                      FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
                      WHERE ub.user_id = other.id), '[]'::json) AS other_badges
     FROM dm_conversations c
     JOIN dm_participants mine ON mine.conversation_id = c.id AND mine.user_id = $2
     JOIN users other ON other.id = CASE WHEN c.user_one_id = $2 THEN c.user_two_id ELSE c.user_one_id END
     WHERE c.id = $1
     LIMIT 1`,
    [conversationId, userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.other_user_id,
      username: row.other_username,
      displayName: row.other_display_name,
      avatarUrl: row.other_avatar_url || "",
      accountType: row.other_account_type || "user",
      isOfficial: row.other_account_type === "system",
      badges: row.other_badges || []
    }
  };
}

export async function listConversations(userId) {
  await ensureAccountSocialBootstrap(userId);
  const result = await query(
    `SELECT c.id, c.created_at, c.updated_at, p.last_read_at,
            other.id AS other_user_id, other.username AS other_username,
            other.display_name AS other_display_name, other.avatar_url AS other_avatar_url,
            other.account_type AS other_account_type,
            COALESCE((SELECT json_agg(json_build_object('code', b.code, 'label', b.label, 'iconKey', b.icon_key)
                      ORDER BY ub.granted_at DESC)
                      FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
                      WHERE ub.user_id = other.id), '[]'::json) AS other_badges,
            latest.id AS last_message_id, latest.content AS last_message_content,
            latest.created_at AS last_message_created_at, latest.sender_user_id AS last_message_sender_id,
            latest.attachment AS last_message_attachment,
            COALESCE(unread.unread_count, 0)::int AS unread_count
     FROM dm_participants p
     JOIN dm_conversations c ON c.id = p.conversation_id
     JOIN users other ON other.id = CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END
     LEFT JOIN LATERAL (
        SELECT m.id, m.content, m.created_at, m.sender_user_id, m.attachment
       FROM dm_messages m
       WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 1
     ) latest ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS unread_count
       FROM dm_messages m
       WHERE m.conversation_id = c.id
         AND m.sender_user_id <> $1
         AND m.created_at > p.last_read_at
     ) unread ON TRUE
     WHERE p.user_id = $1 AND p.hidden_at IS NULL
     ORDER BY (other.account_type = 'system') DESC,
              COALESCE(latest.created_at, c.updated_at) DESC, c.id DESC`,
    [userId]
  );

  const conversations = result.rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unreadCount: row.unread_count,
    user: {
      id: row.other_user_id,
      username: row.other_username,
      displayName: row.other_display_name,
      avatarUrl: row.other_avatar_url || "",
      accountType: row.other_account_type || "user",
      isOfficial: row.other_account_type === "system",
      badges: row.other_badges || []
    },
    lastMessage: row.last_message_id ? {
      id: row.last_message_id,
      content: row.last_message_content,
      createdAt: row.last_message_created_at,
      senderUserId: row.last_message_sender_id,
      attachment: row.last_message_attachment || null
    } : null
  }));
  if (process.env.NODE_ENV !== "production") {
    console.debug("[OFFICIAL:list]", {
      userId,
      conversationCount: conversations.length,
      officialFound: conversations.some((conversation) => conversation.user?.isOfficial === true)
    });
  }
  return conversations;
}

export async function listMessages(conversationId, userId, { before = "", limit = 50 } = {}) {
  const isOfficialConversation = await ensureOfficialConversationBootstrap(conversationId, userId);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 50));
  const params = [conversationId, userId];
  const beforeClause = before ? "AND m.created_at < $3" : "";
  if (before) params.push(new Date(before));
  params.push(safeLimit);
  const limitIndex = params.length;
  const result = await query(
    `SELECT m.id, m.conversation_id, m.sender_user_id, m.content, m.created_at,
            m.message_type, m.official_key, m.attachment,
            u.username, u.display_name, u.avatar_url, u.account_type
     FROM dm_messages m
     JOIN dm_participants p ON p.conversation_id = m.conversation_id AND p.user_id = $2
     JOIN users u ON u.id = m.sender_user_id
     WHERE m.conversation_id = $1 ${beforeClause}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $${limitIndex}`,
    params
  );
  const messages = result.rows.reverse().map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderUserId: row.sender_user_id,
      content: row.content,
      createdAt: row.created_at,
      messageType: row.message_type || "user",
      officialKey: row.official_key || null,
      attachment: row.attachment || null,
      sender: {
        id: row.sender_user_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url || "",
        accountType: row.account_type || "user",
        isOfficial: row.account_type === "system"
      }
    }));
  if (process.env.NODE_ENV !== "production") {
    console.debug("[OFFICIAL:db:messages]", {
      conversationId,
      userId,
      count: messages.length,
      officialCount: messages.filter((message) => message.messageType === "official").length
    });
  }
  const officialKeys = messages.map((message) => message.officialKey).filter(Boolean);
  return {
    messages,
    hasMore: result.rows.length === safeLimit,
    ...(isOfficialConversation ? {
      official: {
        messageCount: officialKeys.length,
        expectedCount: 5,
        keys: officialKeys
      }
    } : {})
  };
}

export async function createMessage(conversationId, senderUserId, content, attachment = null) {
  const result = await query(
    `INSERT INTO dm_messages (conversation_id, sender_user_id, content, attachment)
     SELECT $1, $2, $3, $4::jsonb
     WHERE EXISTS (
       SELECT 1 FROM dm_participants
       WHERE conversation_id = $1 AND user_id = $2
     )
     RETURNING id, conversation_id, sender_user_id, content, created_at, attachment`,
    [conversationId, senderUserId, content, attachment ? JSON.stringify(attachment) : null]
  );
  return result.rows[0] || null;
}

export async function markConversationRead(conversationId, userId) {
  const result = await query(
    `UPDATE dm_participants
     SET last_read_at = NOW()
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING last_read_at`,
    [conversationId, userId]
  );
  return result.rows[0] || null;
}

export async function getConversationUserIds(conversationId) {
  const result = await query(
    `SELECT user_id FROM dm_participants WHERE conversation_id = $1`,
    [conversationId]
  );
  return result.rows.map((row) => row.user_id);
}
