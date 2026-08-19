import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../auth/AuthContext.jsx";
import { SERVER_URL } from "../utils/webrtc.js";

const SocialContext = createContext(null);

async function socialRequest(path, options = {}) {
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
  } catch {
    throw new Error("Nao foi possivel conectar ao EchoLive.");
  }
  if (import.meta.env.DEV && path.includes("/api/social/dms/") && path.includes("/messages")) {
    console.debug("[DM:history:http]", { status: response.status });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Nao foi possivel concluir a operacao.");
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export function SocialProvider({ children }) {
  const { status, user } = useAuth();
  const socketRef = useRef(null);
  const socialDataReadyRef = useRef(false);
  const socketSubscribedRef = useRef(false);
  const [socket, setSocket] = useState(null);
  const [socialStatus, setSocialStatus] = useState("idle");
  const [socialReady, setSocialReady] = useState(false);
  const [friends, setFriends] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [conversations, setConversations] = useState([]);

  const refreshFriends = useCallback(async () => {
    if (status !== "authenticated") return null;
    const snapshot = await socialRequest("/api/social/friends");
    setFriends(snapshot.friends || []);
    setReceivedRequests(snapshot.receivedRequests || []);
    setSentRequests(snapshot.sentRequests || []);
    setOnlineUserIds(new Set(snapshot.onlineUserIds || []));
    return snapshot;
  }, [status]);

  const refreshConversations = useCallback(async () => {
    if (status !== "authenticated") return [];
    const data = await socialRequest("/api/social/dms");
    setConversations(data.conversations || []);
    return data.conversations || [];
  }, [status]);

  const refreshSocial = useCallback(async () => {
    if (status !== "authenticated") return;
    setSocialStatus("loading");
    socialDataReadyRef.current = false;
    setSocialReady(false);
    try {
      await Promise.all([refreshFriends(), refreshConversations()]);
      socialDataReadyRef.current = true;
      const ready = socketSubscribedRef.current;
      setSocialReady(ready);
      setSocialStatus(ready ? "ready" : "loading");
    } catch {
      socialDataReadyRef.current = false;
      setSocialReady(false);
      setSocialStatus("error");
    }
  }, [refreshConversations, refreshFriends, status]);

  useEffect(() => {
    if (status !== "authenticated" || !user?.id) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      socialDataReadyRef.current = false;
      socketSubscribedRef.current = false;
      setSocket(null);
      setSocialReady(false);
      setFriends([]);
      setReceivedRequests([]);
      setSentRequests([]);
      setConversations([]);
      setOnlineUserIds(new Set());
      setSocialStatus(status === "loading" ? "idle" : "guest");
      return undefined;
    }

    const socialSocket = io(SERVER_URL, { withCredentials: true });
    socketRef.current = socialSocket;
    setSocket(socialSocket);
    socialDataReadyRef.current = false;
    socketSubscribedRef.current = false;
    setSocialReady(false);
    setSocialStatus("connecting");

    const subscribe = () => {
      socialSocket.emit("social:subscribe", (result) => {
        if (result?.ok) {
          setOnlineUserIds(new Set(result.onlineUserIds || []));
          socketSubscribedRef.current = true;
          const ready = socialDataReadyRef.current;
          setSocialReady(ready);
          setSocialStatus(ready ? "ready" : "loading");
        } else {
          socketSubscribedRef.current = false;
          setSocialReady(false);
          setSocialStatus("error");
        }
      });
    };
    const refreshFromEvent = () => {
      refreshFriends().catch(() => {});
      refreshConversations().catch(() => {});
    };
    socialSocket.on("connect", subscribe);
    socialSocket.on("social:presence", ({ userId, status: nextStatus } = {}) => {
      setOnlineUserIds((current) => {
        const next = new Set(current);
        if (nextStatus === "online") next.add(userId);
        else next.delete(userId);
        return next;
      });
    });
    socialSocket.on("social:friend-request", refreshFromEvent);
    socialSocket.on("social:friend-updated", refreshFromEvent);
    socialSocket.on("social:conversation-updated", refreshConversations);
    socialSocket.on("connect_error", () => { socketSubscribedRef.current = false; setSocialReady(false); setSocialStatus("error"); });
    socialSocket.on("disconnect", () => { socketSubscribedRef.current = false; setSocialReady(false); setSocialStatus("connecting"); });

    refreshSocial();
    return () => {
      socialSocket.off("connect", subscribe);
      socialSocket.off("social:presence");
      socialSocket.off("social:friend-request", refreshFromEvent);
      socialSocket.off("social:friend-updated", refreshFromEvent);
      socialSocket.off("social:conversation-updated", refreshConversations);
      socialSocket.off("connect_error");
      socialSocket.off("disconnect");
      socialSocket.disconnect();
      socketSubscribedRef.current = false;
      socialDataReadyRef.current = false;
      setSocialReady(false);
      if (socketRef.current === socialSocket) socketRef.current = null;
    };
  }, [refreshConversations, refreshFriends, refreshSocial, status, user?.id]);

  const sendFriendRequest = useCallback(async (username) => {
    const data = await socialRequest("/api/social/friend-requests", { method: "POST", body: JSON.stringify({ username }) });
    await refreshFriends();
    return data;
  }, [refreshFriends]);

  const acceptFriendRequest = useCallback(async (relationId) => {
    await socialRequest(`/api/social/friend-requests/${relationId}/accept`, { method: "POST" });
    await refreshFriends();
  }, [refreshFriends]);

  const deleteFriendRequest = useCallback(async (relationId) => {
    await socialRequest(`/api/social/friend-requests/${relationId}`, { method: "DELETE" });
    await refreshFriends();
  }, [refreshFriends]);

  const removeFriend = useCallback(async (userId) => {
    await socialRequest(`/api/social/friends/${userId}`, { method: "DELETE" });
    await refreshFriends();
  }, [refreshFriends]);

  const startConversation = useCallback(async (userId) => {
    const data = await socialRequest(`/api/social/dms/${userId}`, { method: "POST" });
    const conversation = data.conversation;
    setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
    refreshConversations().catch(() => {});
    return conversation;
  }, [refreshConversations]);

  const loadMessages = useCallback(async (conversationId, before = "") => {
    const query = before ? `?before=${encodeURIComponent(before)}&limit=50` : "?limit=50";
    return socialRequest(`/api/social/dms/${conversationId}/messages${query}`);
  }, []);

  const markRead = useCallback(async (conversationId) => {
    await socialRequest(`/api/social/dms/${conversationId}/read`, { method: "POST" });
    setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation));
    socketRef.current?.emit("dm:read", { conversationId });
  }, []);

  const value = useMemo(() => ({
    acceptFriendRequest,
    conversations,
    deleteFriendRequest,
    friends,
    loadMessages,
    markRead,
    onlineUserIds,
    receivedRequests,
    refreshSocial,
    removeFriend,
    sendFriendRequest,
    sentRequests,
    socket,
    socialReady,
    socialStatus,
    startConversation,
    user
  }), [acceptFriendRequest, conversations, deleteFriendRequest, friends, loadMessages, markRead, onlineUserIds, receivedRequests, refreshSocial, removeFriend, sendFriendRequest, sentRequests, socket, socialReady, socialStatus, startConversation, user]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const context = useContext(SocialContext);
  if (!context) throw new Error("useSocial deve ser usado dentro de SocialProvider.");
  return context;
}
