const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
let pool = null;
let loadError = null;

if (DATABASE_URL) {
  try {
    const { Pool } = await import("pg");
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000
    });
    pool.on("error", (error) => {
      console.error("[DB] pool error:", error.message);
    });
  } catch (error) {
    loadError = error;
  }
}

export const isDatabaseConfigured = Boolean(DATABASE_URL);
export const isDatabaseAvailable = Boolean(pool);

export function getDatabaseError() {
  return loadError;
}

export async function query(text, values = []) {
  if (!pool) {
    throw new Error("DATABASE_UNAVAILABLE");
  }

  return pool.query(text, values);
}

export async function withTransaction(callback) {
  if (!pool) {
    throw new Error("DATABASE_UNAVAILABLE");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  if (!DATABASE_URL || !pool) {
    return false;
  }

  try {
    await pool.query("SELECT 1");
    return true;
  } catch (error) {
    console.error("[DB] unavailable:", error.message);
    return false;
  }
}
