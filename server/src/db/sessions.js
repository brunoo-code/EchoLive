import crypto from "node:crypto";
import { query } from "./pool.js";
import { findUserById } from "./users.js";

const SESSION_DAYS = 14;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getSessionDurationSeconds() {
  return SESSION_DAYS * 24 * 60 * 60;
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const result = await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, last_seen_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'), NOW())
     RETURNING expires_at`,
    [userId, tokenHash, getSessionDurationSeconds()]
  );
  return { token, expiresAt: result.rows[0].expires_at };
}

export async function findSessionUser(token) {
  const tokenHash = hashToken(token);
  const result = await query(
    `SELECT user_id FROM sessions
     WHERE token_hash = $1 AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  const session = result.rows[0];
  if (!session) return null;

  await query("UPDATE sessions SET last_seen_at = NOW() WHERE token_hash = $1", [tokenHash]);
  return findUserById(session.user_id);
}

export async function deleteSession(token) {
  await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function deleteExpiredSessions() {
  await query("DELETE FROM sessions WHERE expires_at <= NOW()");
}
