import { deleteExpiredSessions, deleteSession, findSessionUser, createSession, getSessionDurationSeconds } from "./db/sessions.js";
import { createUser, findUserByUsername, updateUserDisplayName } from "./db/users.js";
import { isDatabaseAvailable, isDatabaseConfigured } from "./db/pool.js";

const SESSION_COOKIE = "echolive_session";
const attemptLog = new Map();

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value).map(([key, ...value]) => [key, decodeURIComponent(value.join("="))]));
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${getSessionDurationSeconds()}${secure}`);
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function getSessionToken(request) {
  return parseCookies(request.headers.cookie || "")[SESSION_COOKIE] || "";
}

function unavailable(response) {
  return response.status(503).json({
    error: "Contas estao temporariamente indisponiveis.",
    code: "AUTH_UNAVAILABLE"
  });
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validateRegisterInput({ username, displayName, password }) {
  const cleanUsername = String(username || "").trim();
  const cleanDisplayName = String(displayName || "").trim();
  const cleanPassword = String(password || "");

  if (!/^[A-Za-z0-9_]{3,24}$/.test(cleanUsername)) {
    return { code: "INVALID_USERNAME", error: "Use entre 3 e 24 caracteres, apenas letras, numeros e _." };
  }
  if (cleanDisplayName.length < 1 || cleanDisplayName.length > 40) {
    return { error: "O nome de exibicao deve ter entre 1 e 40 caracteres." };
  }
  if (cleanPassword.length < 8 || cleanPassword.length > 128) {
    return { error: "A senha deve ter entre 8 e 128 caracteres." };
  }
  return {
    value: {
      username: cleanUsername,
      usernameNormalized: normalizeUsername(cleanUsername),
      displayName: cleanDisplayName,
      password: cleanPassword
    }
  };
}

function validateDisplayName(value) {
  const displayName = String(value || "").trim();
  return displayName.length >= 1 && displayName.length <= 40 ? displayName : null;
}

function isRateLimited(request, action) {
  const key = `${action}:${request.ip || request.socket.remoteAddress || "unknown"}`;
  const now = Date.now();
  const current = attemptLog.get(key) || { count: 0, resetAt: now + 5 * 60 * 1000 };
  if (now > current.resetAt) {
    current.count = 0;
    current.resetAt = now + 5 * 60 * 1000;
  }
  current.count += 1;
  attemptLog.set(key, current);
  return current.count > 12;
}

export async function optionalAuth(request, _response, next) {
  request.user = null;
  request.authUnavailable = !isDatabaseAvailable;
  if (!isDatabaseAvailable) {
    next();
    return;
  }

  const token = getSessionToken(request);
  if (!token) {
    next();
    return;
  }

  try {
    request.user = await findSessionUser(token);
  } catch {
    request.user = null;
    request.authUnavailable = isDatabaseConfigured;
  }
  next();
}

export function requireAuth(request, response, next) {
  if (request.authUnavailable || !isDatabaseAvailable) {
    unavailable(response);
    return;
  }
  if (!request.user) {
    response.status(401).json({ error: "Autenticacao necessaria." });
    return;
  }
  next();
}

export function registerAuthRoutes(app) {
  app.get("/api/auth/me", optionalAuth, (request, response) => {
    if (request.authUnavailable) {
      return unavailable(response);
    }
    return response.json({ status: request.user ? "authenticated" : "guest", user: publicUser(request.user) });
  });

  app.post("/api/auth/register", async (request, response) => {
    if (!isDatabaseAvailable) return unavailable(response);
    if (isRateLimited(request, "register")) return response.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });

    const validation = validateRegisterInput(request.body || {});
    if (validation.error) return response.status(400).json({ error: validation.error, code: validation.code || "INVALID_REGISTER_INPUT" });

    try {
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(validation.value.password, 12);
      const user = await createUser({ ...validation.value, passwordHash });
      const session = await createSession(user.id);
      setSessionCookie(response, session.token);
      return response.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error?.code === "23505") return response.status(409).json({ error: "Esse nome de usuario ja esta em uso.", code: "USERNAME_TAKEN" });
      console.error("[AUTH] register failed:", error.message);
      return unavailable(response);
    }
  });

  app.post("/api/auth/login", async (request, response) => {
    if (!isDatabaseAvailable) return unavailable(response);
    if (isRateLimited(request, "login")) return response.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });

    const username = normalizeUsername(request.body?.username);
    const password = String(request.body?.password || "");
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username) || !password) {
      return response.status(401).json({ error: "Usuario ou senha invalidos." });
    }

    try {
      const user = await findUserByUsername(username);
      const bcrypt = await import("bcryptjs");
      const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
      if (!valid) return response.status(401).json({ error: "Usuario ou senha invalidos." });
      const session = await createSession(user.id);
      setSessionCookie(response, session.token);
      return response.json({ user: publicUser(user) });
    } catch (error) {
      console.error("[AUTH] login failed:", error.message);
      return unavailable(response);
    }
  });

  app.post("/api/auth/logout", optionalAuth, async (request, response) => {
    const token = getSessionToken(request);
    if (token && isDatabaseAvailable) {
      await deleteSession(token).catch(() => {});
    }
    clearSessionCookie(response);
    return response.status(204).end();
  });

  app.patch("/api/users/me", optionalAuth, requireAuth, async (request, response) => {
    const displayName = validateDisplayName(request.body?.displayName);
    if (!displayName) return response.status(400).json({ error: "O nome de exibicao deve ter entre 1 e 40 caracteres." });
    try {
      const user = await updateUserDisplayName(request.user.id, displayName);
      return response.json({ user: publicUser(user) });
    } catch (error) {
      console.error("[AUTH] profile update failed:", error.message);
      return unavailable(response);
    }
  });
}

export function startSessionCleanup() {
  if (!isDatabaseAvailable) return null;
  const timer = setInterval(() => deleteExpiredSessions().catch((error) => console.error("[DB] session cleanup failed:", error.message)), 60 * 60 * 1000);
  timer.unref?.();
  return timer;
}

export { publicUser };
