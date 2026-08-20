import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../auth/AuthContext.jsx";
import { SERVER_URL } from "../utils/webrtc.js";
import { playUiSound } from "../utils/uiSounds.js";

const SocialContext = createContext(null);

function notificationSoundsEnabled() {
  try {
    return window.localStorage.getItem("echolive.uiSounds") !== "false";
  } catch {
    return true;
  }
}

function isVisibleActiveDm(conversationId) {
  if (typeof window === "undefined" || document.visibilityState !== "visible" || !document.hasFocus()) return false;
  const match = window.location.pathname.match(/^\/dm\/([0-9a-f-]{36})$/i);
  return Boolean(match && String(match[1]).toLowerCase() === String(conversationId || "").toLowerCase());
}

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
  const playedSoundEventsRef = useRef(new Set());

  function playSocialSoundOnce(eventKey, soundName) {
    if (!eventKey || playedSoundEventsRef.current.has(eventKey)) return;
    playedSoundEventsRef.current.add(eventKey);
    if (playedSoundEventsRef.current.size > 400) {
      const oldest = playedSoundEventsRef.current.values().next().value;
      if (oldest) playedSoundEventsRef.current.delete(oldest);
    }
    playUiSound(soundName, notificationSoundsEnabled());
  }

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
    const nextConversations = data.conversations || [];
    if (import.meta.env.DEV) {
      const official = nextConversations.find((conversation) => conversation.user?.isOfficial === true);
      console.debug("[OFFICIAL:conversation]", {
        conversationCount: nextConversations.length,
        officialFound: Boolean(official),
        officialConversationId: official?.id || null
      });
    }
    setConversations(nextConversations);
    return nextConversations;
  }, [status]);

  const refreshSocial = useCallback(async () => {
    if (status !== "authenticated") return;
    setSocialStatus("loading");
    socialDataReadyRef.current = false;
    try {
      await Promise.all([refreshFriends(), refreshConversations()]);
      socialDataReadyRef.current = true;
      setSocialStatus(socketSubscribedRef.current ? "ready" : "loading");
      if (socketSubscribedRef.current) setSocialReady(true);
    } catch {
      socialDataReadyRef.current = false;
      setSocialReady(socketSubscribedRef.current);
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
    if (import.meta.env.DEV) console.debug("[SOCIAL:socket:create]");
    socketRef.current = socialSocket;
    setSocket(socialSocket);
    socialDataReadyRef.current = false;
    socketSubscribedRef.current = false;
    setSocialReady(false);
    setSocialStatus("connecting");

    const subscribe = () => {
      if (import.meta.env.DEV) console.debug("[SOCIAL:subscribe:emit]", { userId: user?.id || null });
      socialSocket.emit("social:subscribe", (result) => {
        if (import.meta.env.DEV) console.debug("[SOCIAL:subscribe:ack]", { ok: Boolean(result?.ok) });
        if (result?.ok) {
          setOnlineUserIds(new Set(result.onlineUserIds || []));
          socketSubscribedRef.current = true;
          setSocialReady(true);
          setSocialStatus(socialDataReadyRef.current ? "ready" : "loading");
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
    const handleFriendRequest = (payload = {}) => {
      playSocialSoundOnce(`friend-request:${payload.relationId || "unknown"}`, "friendRequestReceived");
      refreshFromEvent();
    };
    const handleFriendUpdated = (payload = {}) => {
      if (payload.action === "accepted") playSocialSoundOnce(`friend-accepted:${payload.relationId || "unknown"}`, "friendAccepted");
      refreshFromEvent();
    };
    const handleConversationUpdated = (payload = {}) => {
      const message = payload.message;
      if (message && String(message.senderUserId || "") !== String(user.id) && !isVisibleActiveDm(payload.conversationId)) {
        playSocialSoundOnce(`dm-received:${message.id}`, "dmReceived");
      }
      refreshConversations().catch(() => {});
    };
    const handleConnect = () => {
      if (import.meta.env.DEV) console.debug("[SOCIAL:socket:connect]", { socketId: socialSocket.id, connected: socialSocket.connected });
      subscribe();
    };
    const handleConnectError = (error) => {
      if (import.meta.env.DEV) console.debug("[SOCIAL:realtime:error]", { reason: error?.message || "connect_error" });
      socketSubscribedRef.current = false;
      setSocialReady(false);
      setSocialStatus("error");
    };
    const handleDisconnect = (reason) => {
      if (import.meta.env.DEV) console.debug("[DM:socket:disconnect]", { reason: reason || "unknown" });
      socketSubscribedRef.current = false;
      setSocialReady(false);
      setSocialStatus("connecting");
    };
    socialSocket.on("connect", handleConnect);
    socialSocket.on("social:presence", ({ userId, status: nextStatus } = {}) => {
      setOnlineUserIds((current) => {
        const next = new Set(current);
        if (nextStatus === "online") next.add(userId);
        else next.delete(userId);
        return next;
      });
    });
    socialSocket.on("social:friend-request", handleFriendRequest);
    socialSocket.on("social:friend-updated", handleFriendUpdated);
    socialSocket.on("social:conversation-updated", handleConversationUpdated);
    socialSocket.on("connect_error", handleConnectError);
    socialSocket.on("disconnect", handleDisconnect);

    refreshSocial();
    return () => {
      socialSocket.off("connect", handleConnect);
      socialSocket.off("social:presence");
      socialSocket.off("social:friend-request", handleFriendRequest);
      socialSocket.off("social:friend-updated", handleFriendUpdated);
      socialSocket.off("social:conversation-updated", handleConversationUpdated);
      socialSocket.off("connect_error", handleConnectError);
      socialSocket.off("disconnect", handleDisconnect);
      socialSocket.disconnect();
      socketSubscribedRef.current = false;
      socialDataReadyRef.current = false;
      setSocialReady(false);
      if (socketRef.current === socialSocket) socketRef.current = null;
    };
  }, [refreshConversations, refreshFriends, refreshSocial, status, user?.id]);

  const sendFriendRequest = useCallback(async (username) => {
    const data = await socialRequest("/api/social/friend-requests", { method: "POST", body: JSON.stringify({ username }) });
    playSocialSoundOnce(`friend-request-sent:${data.relation?.id || username}`, "friendRequestSent");
    await refreshFriends();
    return data;
  }, [refreshFriends]);

  const acceptFriendRequest = useCallback(async (relationId) => {
    await socialRequest(`/api/social/friend-requests/${relationId}/accept`, { method: "POST" });
    playSocialSoundOnce(`friend-accepted:${relationId}`, "friendAccepted");
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

  const loadUserProfile = useCallback(async (userId) => {
    return socialRequest(`/api/social/users/${userId}/profile`);
  }, []);

  const hideConversation = useCallback(async (conversationId) => {
    await socialRequest(`/api/social/dms/${conversationId}/hide`, { method: "POST" });
    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
  }, []);

  const loadMessages = useCallback(async (conversationId, before = "") => {
    const query = before ? `?before=${encodeURIComponent(before)}&limit=50` : "?limit=50";
    const data = await socialRequest(`/api/social/dms/${conversationId}/messages${query}`);
    if (import.meta.env.DEV) {
      console.debug("[OFFICIAL:context:messages]", {
        conversationId,
        count: data.messages?.length || 0,
        officialCount: data.messages?.filter((message) => message.messageType === "official" || message.message_type === "official").length || 0
      });
    }
    return data;
  }, []);

  const markRead = useCallback(async (conversationId) => {
    await socialRequest(`/api/social/dms/${conversationId}/read`, { method: "POST" });
    setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation));
    socketRef.current?.emit("dm:read", { conversationId });
  }, []);

  const notificationCount = useMemo(() => conversations.reduce((total, conversation) => total + Math.max(0, Number(conversation.unreadCount) || 0), 0) + receivedRequests.length, [conversations, receivedRequests.length]);

  const value = useMemo(() => ({
    acceptFriendRequest,
    conversations,
    deleteFriendRequest,
    friends,
    loadMessages,
    loadUserProfile,
    markRead,
    notificationCount,
    onlineUserIds,
    receivedRequests,
    refreshSocial,
    removeFriend,
    sendFriendRequest,
    sentRequests,
    hideConversation,
    socket,
    socialReady,
    socialStatus,
    startConversation,
    user
  }), [acceptFriendRequest, conversations, deleteFriendRequest, friends, hideConversation, loadMessages, loadUserProfile, markRead, notificationCount, onlineUserIds, receivedRequests, refreshSocial, removeFriend, sendFriendRequest, sentRequests, socket, socialReady, socialStatus, startConversation, user]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const context = useContext(SocialContext);
  if (!context) throw new Error("useSocial deve ser usado dentro de SocialProvider.");
  return context;
}
