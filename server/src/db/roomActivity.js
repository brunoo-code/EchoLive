import { query } from "./pool.js";

const ROOM_ACTIVITY_TTL_MS = 24 * 60 * 60 * 1000;

export async function recordRoomActivity(userId, roomCode, roomDisplayName) {
  const expiresAt = new Date(Date.now() + ROOM_ACTIVITY_TTL_MS);
  await query(
    `INSERT INTO room_user_activity (user_id, room_code, room_display_name, joined_at, last_seen_at, left_at, expires_at)
     VALUES ($1, $2, $3, NOW(), NOW(), NULL, $4)
     ON CONFLICT (user_id, room_code) DO UPDATE SET
       room_display_name = EXCLUDED.room_display_name,
       last_seen_at = NOW(),
       left_at = NULL,
       expires_at = EXCLUDED.expires_at`,
    [userId, roomCode, String(roomDisplayName || `Sala ${roomCode}`).slice(0, 120), expiresAt]
  );
}

export async function markRoomActivityLeft(userId, roomCode) {
  await query(
    `UPDATE room_user_activity
     SET left_at = NOW(), last_seen_at = NOW()
     WHERE user_id = $1 AND room_code = $2 AND expires_at > NOW()`,
    [userId, roomCode]
  );
}

export async function listMutualRooms(viewerId, otherUserId) {
  const result = await query(
    `SELECT a.room_display_name,
            bool_or(activity.left_at IS NULL AND activity.expires_at > NOW()) AS active,
            COUNT(DISTINCT activity.user_id)::int AS participant_count,
            MAX(GREATEST(a.last_seen_at, b.last_seen_at)) AS last_seen_at
     FROM room_user_activity a
     JOIN room_user_activity b
       ON b.room_code = a.room_code
      AND b.user_id = $2
      AND b.expires_at > NOW()
     JOIN room_user_activity activity
       ON activity.room_code = a.room_code
      AND activity.expires_at > NOW()
     WHERE a.user_id = $1
       AND a.expires_at > NOW()
     GROUP BY a.room_code, a.room_display_name
     ORDER BY bool_or(activity.left_at IS NULL AND activity.expires_at > NOW()) DESC, last_seen_at DESC
     LIMIT 20`,
    [viewerId, otherUserId]
  );
  return result.rows.map((row) => ({
    id: `room:${row.room_display_name}:${row.last_seen_at}`,
    name: row.room_display_name,
    active: Boolean(row.active),
    participantCount: row.participant_count,
    joinable: false,
    lastSeenAt: row.last_seen_at
  }));
}
