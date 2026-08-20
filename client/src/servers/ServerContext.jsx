import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { SERVER_URL } from "../utils/webrtc.js";

const ServerContext = createContext(null);

async function request(path, options = {}) {
  const response = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Nao foi possivel acessar os servidores.");
    error.code = data.code || "SERVER_ERROR";
    error.status = response.status;
    throw error;
  }
  return data;
}

export function ServerProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle");

  const refreshServers = useCallback(async () => {
    if (!isAuthenticated) {
      setServers([]);
      setStatus("guest");
      return [];
    }
    setLoading(true);
    setStatus("loading");
    try {
      const data = await request("/api/servers");
      setServers(Array.isArray(data.servers) ? data.servers : []);
      setStatus("ready");
      return data.servers || [];
    } catch (error) {
      setStatus("error");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { refreshServers().catch(() => setServers([])); }, [refreshServers]);

  const createServer = useCallback(async (input) => {
    const data = await request("/api/servers", { method: "POST", body: JSON.stringify(input) });
    setServers((current) => [data.server, ...current.filter((server) => server.id !== data.server.id)]);
    return data.server;
  }, []);

  const updateServer = useCallback(async (serverId, input) => {
    const data = await request(`/api/servers/${serverId}`, { method: "PATCH", body: JSON.stringify(input) });
    setServers((current) => current.map((server) => server.id === serverId ? data.server : server));
    return data.server;
  }, []);

  const deleteServer = useCallback(async (serverId) => {
    await request(`/api/servers/${serverId}`, { method: "DELETE" });
    setServers((current) => current.filter((server) => server.id !== serverId));
  }, []);

  const leaveServer = useCallback(async (serverId) => {
    await request(`/api/servers/${serverId}/leave`, { method: "POST" });
    setServers((current) => current.filter((server) => server.id !== serverId));
  }, []);

  const value = useMemo(() => ({ createServer, deleteServer, leaveServer, loading, refreshServers, servers, status, updateServer }), [createServer, deleteServer, leaveServer, loading, refreshServers, servers, status, updateServer]);
  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServers() {
  const context = useContext(ServerContext);
  if (!context) throw new Error("useServers deve ser usado dentro de ServerProvider.");
  return context;
}
