import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SERVER_URL } from "../utils/webrtc.js";
import { normalizePresence } from "../utils/presence.js";

const AuthContext = createContext(null);

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Nao foi possivel concluir a operacao.");
    error.code = data.code || "AUTH_ERROR";
    error.status = response.status;
    throw error;
  }
  return data;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${SERVER_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    const networkError = new Error("Nao foi possivel conectar ao servidor de contas.");
    networkError.code = "AUTH_NETWORK_ERROR";
    networkError.cause = error;
    throw networkError;
  }
  return readResponse(response);
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [availability, setAvailability] = useState("unknown");
  const profileMutationRef = useRef(0);

  const refreshUser = useCallback(async () => {
    try {
      const data = await request("/api/auth/me");
      setAvailability("available");
      setUser(data.user || null);
      setStatus(data.user ? "authenticated" : "guest");
      return data.user || null;
    } catch (error) {
      if (error.code === "AUTH_UNAVAILABLE" || error.code === "AUTH_NETWORK_ERROR" || error.status === 503) {
        setAvailability("unavailable");
      }
      setUser(null);
      setStatus("guest");
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async ({ username, password }) => {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    setAvailability("available");
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const register = useCallback(async ({ username, password }) => {
    const data = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, displayName: username, password })
    });
    setAvailability("available");
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await request("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setStatus("guest");
  }, []);

  const updateProfile = useCallback(async (profile) => {
    const mutationId = profileMutationRef.current + 1;
    profileMutationRef.current = mutationId;
    const previousUser = user;
    const normalizedProfile = profile.status
      ? { ...profile, status: normalizePresence(profile.status) }
      : profile;
    setUser((current) => current ? { ...current, ...normalizedProfile } : current);

    try {
      const data = await request("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(normalizedProfile)
      });
      if (profileMutationRef.current === mutationId) setUser(data.user);
      setStatus("authenticated");
      return data.user;
    } catch (error) {
      if (profileMutationRef.current === mutationId) setUser(previousUser);
      throw error;
    }
  }, [user]);

  const value = useMemo(() => ({
    availability,
    isAuthenticated: status === "authenticated",
    login,
    logout,
    refreshUser,
    register,
    status,
    updateProfile,
    user
  }), [availability, login, logout, refreshUser, register, status, updateProfile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
