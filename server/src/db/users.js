import { query } from "./pool.js";

function mapUser(row) {
  if (!row) return null;
  const badges = Array.isArray(row.badges) ? row.badges : [];
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    accountType: row.account_type || "user",
    systemKey: row.system_key || null,
    badges,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createUser({ username, usernameNormalized, displayName, passwordHash }) {
  const result = await query(
    `INSERT INTO users (username, username_normalized, display_name, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, display_name, avatar_url, account_type, system_key, created_at, updated_at`,
    [username, usernameNormalized, displayName, passwordHash]
  );
  return mapUser(result.rows[0]);
}

export async function findUserByUsername(usernameNormalized) {
  const result = await query(
    `SELECT id, username, username_normalized, display_name, password_hash, avatar_url, account_type, system_key, created_at, updated_at,
            COALESCE((SELECT json_agg(json_build_object('code', b.code, 'label', b.label, 'description', b.description, 'iconKey', b.icon_key)
                      ORDER BY ub.granted_at DESC)
                      FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
                      WHERE ub.user_id = users.id), '[]'::json) AS badges
     FROM users WHERE username_normalized = $1 LIMIT 1`,
    [usernameNormalized]
  );
  if (!result.rows[0]) return null;
  return { ...mapUser(result.rows[0]), passwordHash: result.rows[0].password_hash };
}

export async function findUserById(id) {
  const result = await query(
    `SELECT id, username, display_name, avatar_url, account_type, system_key, created_at, updated_at,
            COALESCE((SELECT json_agg(json_build_object('code', b.code, 'label', b.label, 'description', b.description, 'iconKey', b.icon_key)
                      ORDER BY ub.granted_at DESC)
                      FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
                      WHERE ub.user_id = users.id), '[]'::json) AS badges
     FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return mapUser(result.rows[0]);
}

export async function updateUserDisplayName(id, displayName) {
  const result = await query(
    `UPDATE users SET display_name = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, display_name, avatar_url, account_type, system_key, created_at, updated_at`,
    [id, displayName]
  );
  return mapUser(result.rows[0]);
}
