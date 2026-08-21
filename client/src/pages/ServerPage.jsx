import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import Icon from "../components/Icon.jsx";
import RoomRail from "../components/RoomRail.jsx";
import Sidebar from "../components/Sidebar.jsx";
import ParticipantsPanel from "../components/ParticipantsPanel.jsx";
import CallMediaView, { MediaPip } from "../components/CallMediaView.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import { ChatComposerFrame, ChatComposerRow, ChatHeader, ChatViewport } from "../components/ChatFrame.jsx";
import EmojiPicker from "../components/EmojiPicker.jsx";
import SocialUserProfileModal from "../components/SocialUserProfileModal.jsx";
import SocialUserProfilePopover from "../components/SocialUserProfilePopover.jsx";
import AudioParticipant from "../components/AudioParticipant.jsx";
import ToastStack from "../components/ToastStack.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useServers } from "../servers/ServerContext.jsx";
import { SERVER_URL } from "../utils/webrtc.js";
import { validateUploadFile } from "../utils/uploadLimits.js";
import { linkifyMessage } from "../utils/linkifyMessage.js";
import useServerVoiceCall from "../hooks/useServerVoiceCall.js";
import useToasts from "../hooks/useToasts.js";

const MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
const FILE_ACCEPT = "application/pdf,application/zip,application/x-zip-compressed,audio/mpeg,audio/wav,audio/ogg,text/plain,application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,.docx,.xlsx,.pptx";
const ALL_ACCEPT = `${MEDIA_ACCEPT},${FILE_ACCEPT}`;

function formatServerTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatServerDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatServerFileSize(bytes) {
  if (!Number.isFinite(Number(bytes))) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isGroupedServerMessage(previous, current) {
  if (!previous || !current || previous.sender?.id !== current.sender?.id) return false;
  const previousTime = new Date(previous.createdAt).getTime();
  const currentTime = new Date(current.createdAt).getTime();
  return Number.isFinite(previousTime) && Number.isFinite(currentTime) && currentTime - previousTime < 5 * 60 * 1000;
}

function handleServerImageError(event) {
  event.currentTarget.hidden = true;
  event.currentTarget.parentElement?.classList.add("is-broken");
}

async function request(path, options = {}) {
  const response = await fetch(`${SERVER_URL}${path}`, { ...options, credentials: "include", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Nao foi possivel acessar o servidor.");
    error.code = data.code || "SERVER_ERROR";
    error.status = response.status;
    throw error;
  }
  return data;
}

export default function ServerPage({ serverId, onNavigateHome, onNavigateSocial, onNavigateServer, onOpenAccountSettings }) {
  const { user, isAuthenticated } = useAuth();
  const { servers, createServer, deleteServer, leaveServer, refreshServers, status: serversStatus, updateServer } = useServers();
  const { toasts, notify } = useToasts();
  const [server, setServer] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState("");
  const [voiceChannelId, setVoiceChannelId] = useState("");
  const [voiceViewChannelId, setVoiceViewChannelId] = useState("");
  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const [members, setMembers] = useState([]);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileAccept, setFileAccept] = useState(ALL_ACCEPT);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingDraft, setEditingDraft] = useState("");
  const [profileUser, setProfileUser] = useState(null);
  const [profileDetailsUser, setProfileDetailsUser] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [serverLoading, setServerLoading] = useState(Boolean(serverId));
  const [serverNotFound, setServerNotFound] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createIconUrl, setCreateIconUrl] = useState("");
  const [createError, setCreateError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsIconUrl, setSettingsIconUrl] = useState("");
  const [settingsNickname, setSettingsNickname] = useState("");
  const [settingsSection, setSettingsSection] = useState("overview");
  const [settingsError, setSettingsError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState("text");
  const [channelError, setChannelError] = useState("");
  const [editingChannelId, setEditingChannelId] = useState("");
  const [editingChannelName, setEditingChannelName] = useState("");
  const [serverActionBusy, setServerActionBusy] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [streamPreset, setStreamPreset] = useState("720p30");
  const [activeContentView, setActiveContentView] = useState("text");
  const [isPipDismissed, setIsPipDismissed] = useState(false);
  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [focusedMediaId, setFocusedMediaId] = useState("");
  const [remoteVolumes, setRemoteVolumes] = useState({});
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const [serverSocket, setServerSocket] = useState(null);

  const activeChannel = useMemo(() => server?.channels?.find((channel) => channel.id === activeChannelId) || server?.channels?.find((channel) => channel.type === "text") || null, [activeChannelId, server]);
  const visibleMessages = useMemo(() => {
    const query = messageQuery.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) => {
      const haystack = [message.content, message.sender?.displayName, message.sender?.username, message.attachment?.name].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [messageQuery, messages]);
  const textChannels = server?.channels?.filter((channel) => channel.type === "text") || [];
  const voiceChannels = server?.channels?.filter((channel) => channel.type === "voice") || [];
  const memberParticipants = useMemo(() => members.map((member) => ({
    ...member,
    socketId: `server-member-${member.id}`,
    nickname: member.displayName || member.username,
    displayName: member.displayName || member.username,
    status: member.id === user?.id ? "online" : member.status || "offline",
    isLocal: member.id === user?.id,
    secondaryText: member.role === "owner" ? "Proprietário" : member.role === "admin" ? "Administrador" : "Membro",
    rawUser: member
  })), [members, user?.id]);
  const currentServerMember = members.find((member) => member.id === user?.id) || null;
  const serverDisplayName = currentServerMember?.displayName || user?.displayName || user?.username || "Conta";
  const voiceIdentity = user ? { id: user.id, userId: user.id, displayName: serverDisplayName, username: user.username, avatarUrl: user.avatarUrl || "", badges: user.badges || [] } : null;
  const serverVoice = useServerVoiceCall({ socket: serverSocket, serverId, channelId: voiceChannelId, identity: voiceIdentity, enabled: Boolean(voiceChannelId), notify });
  const serverCallParticipants = useMemo(() => serverVoice.participants.filter((participant) => participant.isScreenSharing || (participant.cameraEnabled && participant.stream)).sort((left, right) => Number(right.isScreenSharing) - Number(left.isScreenSharing)), [serverVoice.participants]);
  const hasServerScreenShare = serverVoice.participants.some((participant) => participant.isScreenSharing);
  const canManageServer = ["owner", "admin"].includes(server?.role);
  const canDeleteServer = server?.role === "owner";

  useEffect(() => {
    if (!serverVoice.connected) setIsDeafened(false);
  }, [serverVoice.connected]);

  function toggleDeafen() {
    setIsDeafened((current) => !current);
  }

  function changeRemoteVolume(socketId, volume) {
    setRemoteVolumes((current) => ({ ...current, [socketId]: volume }));
  }

  useEffect(() => {
    setServer(null);
    setMembers([]);
    setMessages([]);
    setHasMoreMessages(false);
    setLoadingOlderMessages(false);
    setActiveChannelId("");
    setVoiceChannelId("");
    setVoiceViewChannelId("");
    setDraft("");
    setTypingUsers([]);
    setSelectedFile(null);
    setReplyingTo(null);
    setEditingMessageId("");
    setEditingDraft("");
    setError("");
    setActiveContentView("text");
    setViewMode("grid");
    setFocusedMediaId("");
    setRemoteVolumes({});
  }, [serverId]);

  useEffect(() => {
    if (!isAuthenticated || !serverId) {
      setServer(null);
      setServerLoading(false);
      setServerNotFound(false);
      return;
    }
    let active = true;
    setServerLoading(true);
    setServerNotFound(false);
    setError("");
    Promise.all([request(`/api/servers/${serverId}`), request(`/api/servers/${serverId}/members`)]).then(([serverData, memberData]) => { if (active) { setServer(serverData.server); setMembers(memberData.members || []); } }).catch((requestError) => { if (active) { setServer(null); setServerNotFound(requestError.status === 404); setError(requestError.message); } }).finally(() => { if (active) setServerLoading(false); });
    return () => { active = false; };
  }, [isAuthenticated, serverId]);

  useEffect(() => {
    if (!isAuthenticated || !serverId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setServerSocket(null);
      setVoiceChannelId("");
      return undefined;
    }
    const socket = io(SERVER_URL, { withCredentials: true });
    socketRef.current = socket;
    setServerSocket(socket);
    const handleConnect = () => {
      if (import.meta.env.DEV) console.debug("[SERVER:socket]", { serverId, socketId: socket.id, connected: socket.connected });
    };
    const handleConnectError = (socketError) => {
      if (import.meta.env.DEV) console.debug("[SERVER:socket:error]", { serverId, message: socketError?.message || "unknown" });
    };
    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    return () => {
      socket.emit("server:voice-leave");
      socket.disconnect();
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      if (socketRef.current === socket) socketRef.current = null;
      setServerSocket((current) => current === socket ? null : current);
      setVoiceChannelId("");
    };
  }, [isAuthenticated, serverId]);

  useEffect(() => {
    if (!serverId || !activeChannel?.id || activeChannel.type !== "text" || !serverSocket) return undefined;
    let active = true;
    setActiveChannelId(activeChannel.id);
    request(`/api/servers/${serverId}/channels/${activeChannel.id}/messages?limit=50`).then((data) => { if (active) { setMessages(data.messages || []); setHasMoreMessages(Boolean(data.hasMore)); } }).catch((requestError) => { if (active) setError(requestError.message); });
    const subscribe = () => serverSocket.emit("server:subscribe", { serverId, channelId: activeChannel.id });
    const handleMessage = (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    const handleReaction = ({ messageId, emoji, active: reactionActive }) => setMessages((current) => current.map((message) => message.id !== messageId ? message : { ...message, reactions: updateReactionList(message.reactions, emoji, reactionActive) }));
    const handleMessageUpdated = (message) => setMessages((current) => current.map((item) => item.id === message?.id ? message : item));
    const handleMessageDeleted = ({ messageId } = {}) => setMessages((current) => current.map((item) => item.id === messageId ? { ...item, content: "", attachment: null, deletedAt: new Date().toISOString() } : item));
    const handleTyping = ({ serverId: eventServerId, channelId: eventChannelId, userId, displayName, typing } = {}) => {
      if (eventServerId !== serverId || eventChannelId !== activeChannel.id || userId === user?.id) return;
      setTypingUsers((current) => {
        if (!typing) return current.filter((item) => item.userId !== userId);
        const next = { userId, displayName: displayName || "Alguem" };
        return current.some((item) => item.userId === userId) ? current.map((item) => item.userId === userId ? next : item) : [...current, next];
      });
    };
    if (serverSocket.connected) subscribe();
    else serverSocket.once("connect", subscribe);
    serverSocket.on("server:message-created", handleMessage);
    serverSocket.on("server:reaction-updated", handleReaction);
    serverSocket.on("server:message-updated", handleMessageUpdated);
    serverSocket.on("server:message-deleted", handleMessageDeleted);
    serverSocket.on("server:typing", handleTyping);
    return () => {
      active = false;
      stopServerTyping();
      setTypingUsers([]);
      serverSocket.emit("server:unsubscribe", { serverId, channelId: activeChannel.id });
      serverSocket.off("connect", subscribe);
      serverSocket.off("server:message-created", handleMessage);
      serverSocket.off("server:reaction-updated", handleReaction);
      serverSocket.off("server:message-updated", handleMessageUpdated);
      serverSocket.off("server:message-deleted", handleMessageDeleted);
      serverSocket.off("server:typing", handleTyping);
    };
  }, [activeChannel?.id, isAuthenticated, serverId, serverSocket, user?.id]);

  useEffect(() => {
    if (!activeChannel?.id || !serverId) return;
    try { setDraft(JSON.parse(localStorage.getItem("echolive.serverDrafts") || "{}")[`${serverId}:${activeChannel.id}`] || ""); } catch { setDraft(""); }
  }, [activeChannel?.id, serverId]);

  useEffect(() => {
    if (!activeChannel?.id || !serverId) return;
    try {
      const drafts = JSON.parse(localStorage.getItem("echolive.serverDrafts") || "{}");
      const key = `${serverId}:${activeChannel.id}`;
      if (draft) drafts[key] = draft; else delete drafts[key];
      localStorage.setItem("echolive.serverDrafts", JSON.stringify(drafts));
    } catch {}
  }, [activeChannel?.id, draft, serverId]);

  useEffect(() => {
    if (!serverId && servers[0]) onNavigateServer?.(servers[0].id);
  }, [onNavigateServer, serverId, servers]);

  function handleCreateServer() {
    setCreateName("");
    setCreateIconUrl("");
    setCreateError("");
    setCreateOpen(true);
  }

  async function submitCreateServer(event) {
    event.preventDefault();
    const name = createName.trim();
    if (name.length < 2 || name.length > 60) {
      setCreateError("Use um nome entre 2 e 60 caracteres.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const created = await createServer({ name, iconUrl: createIconUrl });
      setCreateOpen(false);
      setCreateName("");
      setCreateIconUrl("");
      onNavigateServer?.(created.id);
    } catch (requestError) {
      setCreateError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  function selectServerIcon(event, setter, setFieldError) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type) || file.size > 2 * 1024 * 1024) {
      setFieldError("Use uma imagem PNG, JPEG ou WebP de ate 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setter(String(reader.result || ""));
      setFieldError("");
    };
    reader.onerror = () => setFieldError("Nao foi possivel ler esta imagem.");
    reader.readAsDataURL(file);
  }

  function openServerSettings(section = canManageServer ? "overview" : "identity") {
    setSettingsName(server?.name || "");
    setSettingsIconUrl(server?.iconUrl || "");
    setSettingsNickname(members.find((member) => member.id === user?.id)?.serverNickname || "");
    setSettingsSection(section);
    setSettingsError("");
    setSettingsOpen(true);
  }

  async function submitServerSettings(event) {
    event.preventDefault();
    const name = settingsName.trim();
    if (name.length < 2 || name.length > 60) {
      setSettingsError("Use um nome entre 2 e 60 caracteres.");
      return;
    }
    setServerActionBusy(true);
    setSettingsError("");
    try {
      let updated = server;
      if (canManageServer) {
        updated = await updateServer(serverId, { name, iconUrl: settingsIconUrl });
        setServer(updated);
      }
      const nicknameData = await request(`/api/servers/${serverId}/members/me`, { method: "PATCH", body: JSON.stringify({ nickname: settingsNickname }) });
      if (nicknameData.member) setMembers((current) => current.map((member) => member.id === nicknameData.member.id ? nicknameData.member : member));
      setSettingsOpen(false);
      notify("Configuracoes do servidor salvas.");
    } catch (requestError) {
      setSettingsError(requestError.message);
    } finally {
      setServerActionBusy(false);
    }
  }

  async function openServerInvite() {
    setInviteLink("");
    setInviteError("");
    setInviteOpen(true);
    try {
      const data = await request(`/api/servers/${serverId}/invites`, { method: "POST", body: JSON.stringify({}) });
      const code = data.invite?.code;
      if (!code) throw new Error("Nao foi possivel criar o convite.");
      setInviteLink(`${window.location.origin}/invite/${code}`);
    } catch (requestError) {
      setInviteError(requestError.message);
    }
  }

  async function copyServerInvite() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      notify("Convite copiado.");
    } catch {
      setInviteError("Nao foi possivel copiar o convite.");
    }
  }

  function openLeaveServer() {
    setLeaveOpen(true);
  }

  async function confirmLeaveServer() {
    if (server?.role === "owner") return;
    setServerActionBusy(true);
    try {
      await leaveServer(serverId);
      setLeaveOpen(false);
      notify("Voce saiu do servidor.");
      onNavigateSocial?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setServerActionBusy(false);
    }
  }

  function openDeleteServer() {
    setDeleteName("");
    setDeleteError("");
    setDeleteOpen(true);
  }

  async function confirmDeleteServer() {
    if (deleteName !== server?.name) return;
    setServerActionBusy(true);
    setDeleteError("");
    try {
      await deleteServer(serverId);
      setDeleteOpen(false);
      notify("Servidor excluido.");
      onNavigateSocial?.();
    } catch (requestError) {
      setDeleteError(requestError.message);
    } finally {
      setServerActionBusy(false);
    }
  }

  function openCreateChannel(type = "text") {
    setChannelType(type);
    setChannelName("");
    setChannelError("");
    setChannelOpen(true);
  }

  async function submitCreateChannel(event) {
    event.preventDefault();
    const name = channelName.trim();
    if (!name || name.length > 40) {
      setChannelError("Use um nome entre 1 e 40 caracteres.");
      return;
    }
    setServerActionBusy(true);
    setChannelError("");
    try {
      const data = await request(`/api/servers/${serverId}/channels`, { method: "POST", body: JSON.stringify({ name, type: channelType }) });
      const created = data.channel;
      setServer((current) => current ? { ...current, channels: [...(current.channels || []), created] } : current);
      setChannelOpen(false);
      notify("Canal criado.");
    } catch (requestError) {
      setChannelError(requestError.message);
    } finally {
      setServerActionBusy(false);
    }
  }

  async function saveChannelName(channel) {
    const name = editingChannelName.trim();
    if (!name || name.length > 40) {
      setSettingsError("Use um nome de canal entre 1 e 40 caracteres.");
      return;
    }
    setServerActionBusy(true);
    setSettingsError("");
    try {
      const data = await request(`/api/servers/${serverId}/channels/${channel.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setServer((current) => current ? { ...current, channels: current.channels.map((item) => item.id === channel.id ? data.channel : item) } : current);
      setEditingChannelId("");
      setEditingChannelName("");
    } catch (requestError) {
      setSettingsError(requestError.message);
    } finally {
      setServerActionBusy(false);
    }
  }

  async function removeChannel(channel) {
    if (!window.confirm(`Excluir o canal ${channel.name}?`)) return;
    setServerActionBusy(true);
    setSettingsError("");
    try {
      await request(`/api/servers/${serverId}/channels/${channel.id}`, { method: "DELETE" });
      setServer((current) => current ? { ...current, channels: current.channels.filter((item) => item.id !== channel.id) } : current);
      if (activeChannelId === channel.id) setActiveChannelId("");
      if (voiceChannelId === channel.id) {
        serverVoice.leave();
        setVoiceChannelId("");
        setVoiceViewChannelId("");
      }
    } catch (requestError) {
      setSettingsError(requestError.message);
    } finally {
      setServerActionBusy(false);
    }
  }

  async function loadOlderServerMessages() {
    const firstMessage = messages[0];
    if (!firstMessage?.id || !hasMoreMessages || loadingOlderMessages) return;
    setLoadingOlderMessages(true);
    try {
      const data = await request(`/api/servers/${serverId}/channels/${activeChannel.id}/messages?limit=50&before=${encodeURIComponent(firstMessage.id)}`);
      setMessages((current) => [...(data.messages || []).filter((message) => !current.some((item) => item.id === message.id)), ...current]);
      setHasMoreMessages(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingOlderMessages(false);
    }
  }

  useEffect(() => {
    if (!createOpen && !settingsOpen && !inviteOpen && !leaveOpen && !deleteOpen && !channelOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || creating || serverActionBusy) return;
      setCreateOpen(false);
      setSettingsOpen(false);
      setInviteOpen(false);
      setLeaveOpen(false);
      setDeleteOpen(false);
      setChannelOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [channelOpen, createOpen, creating, deleteOpen, inviteOpen, leaveOpen, serverActionBusy, settingsOpen]);

  function validateServerFile(file) {
    if (!file) return false;
    const result = validateUploadFile(file);
    if (!result.ok) {
      notify(result.error);
      return false;
    }
    return true;
  }

  function handleServerFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(validateServerFile(file) ? file : null);
    event.target.value = "";
    setIsAttachMenuOpen(false);
  }

  function openServerFilePicker(accept) {
    setFileAccept(accept);
    setIsAttachMenuOpen(false);
    setIsEmojiPickerOpen(false);
    window.requestAnimationFrame(() => fileInputRef.current?.click());
  }

  function insertServerEmoji(emoji) {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const nextDraft = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`.slice(0, 4000);
    setDraft(nextDraft);
    setIsEmojiPickerOpen(false);
    window.requestAnimationFrame(() => {
      input?.focus();
      const nextCursor = Math.min(start + emoji.length, 4000);
      input?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function stopServerTyping() {
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (isTypingRef.current) {
      serverSocket?.emit("server:typing", { serverId, channelId: activeChannel?.id, typing: false });
      isTypingRef.current = false;
    }
  }

  function handleDraftChange(value) {
    setDraft(value);
    if (!serverSocket?.connected || !activeChannel?.id || activeChannel.type !== "text" || !value.trim()) {
      stopServerTyping();
      return;
    }
    if (!isTypingRef.current) {
      serverSocket.emit("server:typing", { serverId, channelId: activeChannel.id, typing: true });
      isTypingRef.current = true;
    }
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(stopServerTyping, 1800);
  }

  async function uploadServerFile(file) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${SERVER_URL}/api/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(activeChannel.id)}/upload`, { method: "POST", body, credentials: "include" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Falha ao enviar o arquivo.");
    return result.attachment;
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!serverId || !activeChannel?.id || (!content && !selectedFile)) {
      if (!content && !selectedFile) notify("Digite uma mensagem ou anexe um arquivo.");
      return;
    }
    if (content.length > 4000) {
      notify("Esta mensagem excede o limite de 4.000 caracteres.");
      return;
    }

    setIsSending(true);
    try {
      const attachment = selectedFile ? await uploadServerFile(selectedFile) : null;
      const payload = { serverId, channelId: activeChannel.id, content, attachment, replyToMessageId: replyingTo?.id || null };
      const socket = socketRef.current;
      if (socket?.connected) {
        const result = await new Promise((resolve) => socket.emit("server:message", payload, resolve));
        if (!result?.ok) throw new Error(result?.error || "Nao foi possivel enviar a mensagem.");
      } else {
        const data = await request(`/api/servers/${serverId}/channels/${activeChannel.id}/messages`, { method: "POST", body: JSON.stringify({ content, attachment, replyToMessageId: replyingTo?.id || null }) });
        setMessages((current) => current.some((item) => item.id === data.message.id) ? current : [...current, data.message]);
      }
      setDraft("");
      stopServerTyping();
      setSelectedFile(null);
      setReplyingTo(null);
    } catch (requestError) {
      setError(requestError.message || "Nao foi possivel enviar a mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  function handleMessageKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function editMessage(message) {
    const content = editingDraft.trim();
    if (!content || content.length > 4000) return;
    const payload = { serverId, channelId: activeChannel?.id, messageId: message.id, content };
    const socket = serverSocket;
    try {
      if (socket?.connected) {
        const result = await new Promise((resolve) => socket.emit("server:message-edit", payload, resolve));
        if (!result?.ok) throw new Error(result?.error || "Nao foi possivel editar a mensagem.");
      } else {
        const result = await request(`/api/servers/${serverId}/channels/${activeChannel.id}/messages/${message.id}`, { method: "PATCH", body: JSON.stringify({ content }) });
        setMessages((current) => current.map((item) => item.id === message.id ? result.message : item));
      }
      setEditingMessageId("");
      setEditingDraft("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteMessage(message) {
    const payload = { serverId, channelId: activeChannel?.id, messageId: message.id };
    const socket = serverSocket;
    try {
      if (socket?.connected) {
        const result = await new Promise((resolve) => socket.emit("server:message-delete", payload, resolve));
        if (!result?.ok) throw new Error(result?.error || "Nao foi possivel remover a mensagem.");
      } else {
        await request(`/api/servers/${serverId}/channels/${activeChannel.id}/messages/${message.id}`, { method: "DELETE" });
        setMessages((current) => current.map((item) => item.id === message.id ? { ...item, content: "", attachment: null, deletedAt: new Date().toISOString() } : item));
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function toggleReaction(messageId, emoji) {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("server:reaction", { serverId, channelId: activeChannel?.id, messageId, emoji }, (result) => { if (!result?.ok) setError(result?.error || "Nao foi possivel atualizar a reacao."); });
      return;
    }
    request(`/api/servers/${serverId}/channels/${activeChannel.id}/messages/${messageId}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) }).then((result) => setMessages((current) => current.map((message) => message.id === messageId ? { ...message, reactions: updateReactionList(message.reactions, emoji, result.active) } : message))).catch((requestError) => setError(requestError.message));
  }

  function toggleVoice(channelId) {
    setError("");
    setVoiceViewChannelId(channelId);
    setActiveContentView("media");
    if (voiceChannelId !== channelId) setVoiceChannelId(channelId);
  }

  function selectServerChannel(channelId) {
    const channel = server?.channels?.find((item) => item.id === channelId);
    setMessageQuery("");
    setActiveChannelId(channelId);
    if (channel?.type === "text") {
      setVoiceViewChannelId("");
      setActiveContentView("text");
    }
  }

  useEffect(() => {
    if (serverVoice.isScreenSharing || serverVoice.cameraEnabled) setIsPipDismissed(false);
  }, [serverVoice.cameraEnabled, serverVoice.isScreenSharing]);

  const showServerLoading = Boolean(serverId && serverLoading);
  const showServerListLoading = !serverId && (serversStatus === "idle" || serversStatus === "loading");
  const showServerListError = !serverId && serversStatus === "error";
  const showServerEmpty = !serverId && serversStatus === "ready" && !servers.length;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const renderBranch = showServerLoading ? "loading-server" : serverNotFound ? "not-found" : showServerListError ? "server-list-error" : showServerEmpty ? "empty-server-list" : messages.length ? "messages" : "empty-channel";
    console.debug("[SERVER:UI]", {
      serverId: serverId || null,
      serverLoaded: Boolean(server),
      selectedChannelId: activeChannel?.id || null,
      selectedChannelType: activeChannel?.type || null,
      voiceChannelId: voiceChannelId || null,
      voiceConnected: serverVoice.connected,
      memberCount: members.length,
      messageCount: messages.length,
      renderBranch
    });
  }, [activeChannel?.id, activeChannel?.type, members.length, messages.length, server, serverId, serverNotFound, serverVoice.connected, showServerEmpty, showServerListError, showServerLoading, voiceChannelId]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug("[SERVER:VOICE:UI]", {
      serverId: serverId || null,
      channelId: voiceChannelId || null,
      activeVoiceRow: Boolean(voiceChannelId),
      footerVisible: serverVoice.connected,
      participantCount: serverVoice.participants.length,
      controls: {
        microphone: serverVoice.micEnabled,
        camera: serverVoice.cameraEnabled,
        screenShare: serverVoice.isScreenSharing
      }
    });
  }, [serverId, serverVoice.cameraEnabled, serverVoice.connected, serverVoice.isScreenSharing, serverVoice.micEnabled, serverVoice.participants.length, voiceChannelId]);

  function renderServerMessage(message, index) {
    const previousMessage = visibleMessages[index - 1];
    const isGrouped = isGroupedServerMessage(previousMessage, message);
    const replyTarget = message.replyToMessageId ? messages.find((item) => item.id === message.replyToMessageId) : null;
    const attachment = message.attachment;
    const attachmentSource = attachment?.url ? `${SERVER_URL}${attachment.url}` : "";
    const senderName = message.sender?.displayName || message.sender?.username || "Usuário";

    return (
      <article id={`server-message-${message.id}`} className={`chat-message server-chat-message${isGrouped ? " is-grouped" : ""}`} key={message.id}>
        {isGrouped ? <div className="message-avatar-placeholder server-message-time" aria-hidden="true"><time dateTime={message.createdAt}>{formatServerTime(message.createdAt)}</time></div> : <button type="button" className="message-avatar server-message-avatar" onClick={(event) => setProfileUser({ user: message.sender, anchorRect: event.currentTarget.getBoundingClientRect() })} aria-label={`Ver perfil de ${senderName}`}><UserAvatar user={message.sender} size={36} /></button>}
        <div className="message-body">
          {!isGrouped && <div className="message-meta"><strong>{senderName}</strong><time dateTime={message.createdAt} title={formatServerDateTime(message.createdAt)}>{formatServerTime(message.createdAt)}</time></div>}
          {replyTarget && <button type="button" className="server-reply-ref" onClick={() => document.getElementById(`server-message-${replyTarget.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>Respondendo a <strong>{replyTarget.sender?.displayName || replyTarget.sender?.username || "uma mensagem"}</strong>{replyTarget.content ? `: ${replyTarget.content.slice(0, 100)}` : ""}</button>}
          {editingMessageId === message.id ? <form className="server-message-edit-form" onSubmit={(event) => { event.preventDefault(); editMessage(message); }}><textarea value={editingDraft} onChange={(event) => setEditingDraft(event.target.value)} maxLength={4000} autoFocus /><div><button type="submit" className="primary-button">Salvar</button><button type="button" className="secondary-button" onClick={() => { setEditingMessageId(""); setEditingDraft(""); }}>Cancelar</button></div></form> : message.deletedAt ? <p className="server-message-deleted">Mensagem removida.</p> : message.content ? <p>{linkifyMessage(message.content)}{message.editedAt && <small className="edited-message-label"> (editada)</small>}</p> : null}
          {attachment && attachmentSource && <div className="message-attachment server-message-attachment">
            {attachment.type === "image" ? <button type="button" className="server-image-button" onClick={() => setLightboxImage({ source: attachmentSource, alt: attachment.name || "Imagem anexada" })}><img src={attachmentSource} alt={attachment.name || "Imagem anexada"} onError={handleServerImageError} /></button> : attachment.type === "video" ? <video controls preload="metadata" src={attachmentSource} /> : <a className="file-attachment" href={attachmentSource} target="_blank" rel="noreferrer" download>{attachment.name || "Arquivo"}</a>}
            <span>{attachment.name || "Arquivo"}{attachment.size ? ` · ${formatServerFileSize(attachment.size)}` : ""}</span>
          </div>}
          {!message.deletedAt && (message.reactions || []).length > 0 && <div className="server-message-reactions">{message.reactions.map((reaction) => <button type="button" key={reaction.emoji} className={reaction.reacted ? "is-active" : ""} onClick={() => toggleReaction(message.id, reaction.emoji)}>{reaction.emoji} <small>{reaction.count}</small></button>)}</div>}
          {!message.deletedAt && !editingMessageId && <div className="server-message-hover-toolbar" aria-label="Ações da mensagem"><button type="button" onClick={() => setReplyingTo(message)} title="Responder" aria-label="Responder"><Icon name="reply" size={13} /></button><button type="button" onClick={() => toggleReaction(message.id, "👍")} title="Adicionar reação" aria-label="Adicionar reação">😊</button>{message.sender?.id === user?.id && <><button type="button" onClick={() => { setEditingMessageId(message.id); setEditingDraft(message.content || ""); }} title="Editar mensagem" aria-label="Editar mensagem"><Icon name="edit" size={13} /></button><button type="button" onClick={() => deleteMessage(message)} title="Remover mensagem" aria-label="Remover mensagem"><Icon name="trash" size={13} /></button></>}</div>}
        </div>
      </article>
    );
  }

  if (!isAuthenticated) return <main className="page server-page server-page-gate"><section className="social-guest-gate"><Icon name="lock" size={24} /><h1>Servidores ficam com a sua conta.</h1><p>Entre ou crie uma conta para manter seus servidores, canais e mensagens por aqui.</p><button type="button" className="primary-button" onClick={onNavigateHome}>Voltar para a Home</button></section></main>;

  const serverSidebarState = server ? null : showServerLoading || showServerListLoading ? <div className="server-empty server-loading-state"><span className="loading-sheen" /><strong>Carregando servidor...</strong><span>Buscando canais e participantes.</span></div> : <div className="server-empty"><Icon name={serverNotFound || showServerListError ? "alert" : "server"} size={24} /><strong>{serverNotFound ? "Servidor não encontrado" : showServerListError ? "Não foi possível carregar" : "Crie seu primeiro servidor"}</strong><span>{serverNotFound ? "Esse servidor não está disponível para sua conta." : showServerListError ? "Tente novamente para carregar seus servidores." : "Um espaço persistente para suas conversas."}</span>{showServerListError ? <button type="button" className="secondary-button" onClick={() => refreshServers().catch(() => {})}>Tentar novamente</button> : <button type="button" className="primary-button" onClick={handleCreateServer}>Criar servidor</button>}</div>;

  return <main className={`page app-shell room-page server-page ${activeContentView === "media" && !isMemberPanelOpen ? "call-members-collapsed" : ""}`}>
    <RoomRail roomCode="" roomName="" recentRooms={[]} onHome={onNavigateHome} onSocial={onNavigateSocial} onOpenSwitcher={handleCreateServer} servers={servers} activeServerId={serverId} onOpenServer={onNavigateServer} onCreateServer={handleCreateServer} />
    <Sidebar variant="server" serverName={server?.name || "Seus servidores"} serverIconUrl={server?.iconUrl || ""} serverTextChannels={textChannels} serverVoiceChannels={voiceChannels} serverActiveChannelId={activeChannel?.id} serverVoiceChannelId={voiceChannelId} serverVoiceViewedChannelId={activeContentView === "media" ? voiceViewChannelId : ""} serverConnectedVoiceChannelId={serverVoice.connected ? voiceChannelId : ""} voiceChannelName={voiceChannels.find((channel) => channel.id === voiceChannelId)?.name || voiceChannels[0]?.name || "Geral"} onSelectServerChannel={selectServerChannel} onToggleServerVoice={toggleVoice} serverVoiceParticipants={serverVoice.participants} serverNavigationState={serverSidebarState} nickname={serverDisplayName} status={user?.status || "online"} customStatus={user?.customStatus || ""} avatarUrl={user?.avatarUrl || ""} avatarVariant={user?.avatarVariant || 0} isInVoice={serverVoice.connected} connectionQuality="" micEnabled={serverVoice.micEnabled} cameraEnabled={serverVoice.cameraEnabled} isScreenSharing={serverVoice.isScreenSharing} streamPreset={streamPreset} screenShareLabel={streamPreset.replace("p", "p · ").replace("30", "30 FPS").replace("60", "60 FPS")} onStreamPresetChange={setStreamPreset} isDeafened={isDeafened} onProfileClick={(event) => setProfileUser({ user: { ...user, displayName: serverDisplayName, serverNickname: currentServerMember?.serverNickname || "" }, anchorRect: event?.currentTarget?.getBoundingClientRect?.() })} onOpenUserSettings={onOpenAccountSettings} onToggleMicrophone={serverVoice.toggleMicrophone} onToggleCamera={serverVoice.toggleCamera} onToggleScreenShare={serverVoice.toggleScreenShare} onToggleDeafen={toggleDeafen} onLeaveVoice={() => { serverVoice.leave(); setVoiceChannelId(""); setVoiceViewChannelId(""); setActiveContentView("text"); }} onJoinVoice={() => voiceChannels[0] && toggleVoice(voiceChannels[0].id)} onLeaveRoom={onNavigateHome} onServerInvite={canManageServer ? openServerInvite : undefined} onServerSettings={server ? openServerSettings : undefined} onServerLeave={server ? openLeaveServer : undefined} onServerDelete={canDeleteServer ? openDeleteServer : undefined} canManageServer={canManageServer} canDeleteServer={canDeleteServer} onCreateServerChannel={canManageServer ? openCreateChannel : undefined} />
    <section className="central-stage">
      {activeContentView === "media" ? <CallMediaView participants={serverVoice.participants} channelName={voiceChannels.find((channel) => channel.id === voiceChannelId)?.name || "Geral"} participantCount={serverVoice.participants.length} isInVoice={serverVoice.connected} viewMode={viewMode} onViewModeChange={setViewMode} focusedMediaId={focusedMediaId} onFocusParticipant={setFocusedMediaId} isDeafened={isDeafened} volumeById={remoteVolumes} onVolumeChange={changeRemoteVolume} screenShareLabel={streamPreset.replace("p", "p · ").replace("30", "30 FPS").replace("60", "60 FPS")} notify={notify} micEnabled={serverVoice.micEnabled} onToggleMicrophone={serverVoice.toggleMicrophone} cameraEnabled={serverVoice.cameraEnabled} onToggleCamera={serverVoice.toggleCamera} isScreenSharing={serverVoice.isScreenSharing} onToggleScreenShare={serverVoice.toggleScreenShare} onToggleDeafen={toggleDeafen} onLeaveVoice={() => { serverVoice.leave(); setVoiceChannelId(""); setVoiceViewChannelId(""); setActiveContentView("text"); }} membersVisible={isMemberPanelOpen} onToggleMembers={() => setIsMemberPanelOpen((value) => !value)} streamPreset={streamPreset} onStreamPresetChange={setStreamPreset} /> : <section className="chat-stage channel-view">
      <div className="chat-stage-inner">
      <ChatHeader title={activeChannel?.name || (showServerEmpty ? "Seus servidores" : "Selecione um canal")} subtitle={server ? `${server.memberCount} membro${server.memberCount === 1 ? "" : "s"}` : ""} type={activeChannel?.type === "voice" ? "voice" : "text"} searchValue={messageQuery} onSearchChange={setMessageQuery} />
          {serverVoice.connected && (hasServerScreenShare || serverVoice.cameraEnabled) && <button type="button" className="active-media-view-banner" onClick={() => setActiveContentView("media")}><Icon name={hasServerScreenShare ? "screenShare" : "camera"} size={15} /><span>{hasServerScreenShare ? "Transmissao ativa" : "Camera ativa"}</span><strong>Ver chamada</strong></button>}
          {serverVoice.connected && serverCallParticipants[0] && !isPipDismissed && <MediaPip participant={serverCallParticipants[0]} onOpen={() => setActiveContentView("media")} onClose={() => setIsPipDismissed(true)} isDeafened={isDeafened} volume={remoteVolumes[serverCallParticipants[0].socketId] ?? 100} onVolumeChange={(volume) => changeRemoteVolume(serverCallParticipants[0].socketId, volume)} notify={notify} />}
      {error && <div className="server-error" role="alert">{error}<button type="button" className="icon-button" onClick={() => setError("")} aria-label="Fechar aviso"><Icon name="close" size={14} /></button></div>}
      <ChatViewport>{hasMoreMessages && !messageQuery.trim() && <div className="server-history-loader"><button type="button" className="text-button" onClick={loadOlderServerMessages} disabled={loadingOlderMessages}>{loadingOlderMessages ? "Carregando..." : "Carregar mensagens anteriores"}</button></div>}{showServerLoading || showServerListLoading ? <ServerLoadingState /> : serverNotFound ? <div className="server-welcome server-state-message"><Icon name="warning" size={30} /><h2>Servidor indisponível</h2><p>Verifique o endereço ou volte para a lista de servidores.</p><button type="button" className="secondary-button" onClick={() => onNavigateServer?.("")}>Voltar aos servidores</button></div> : showServerListError ? <div className="server-welcome server-state-message"><Icon name="warning" size={30} /><h2>Não foi possível carregar</h2><p>O shell está pronto, mas a lista de servidores não respondeu.</p><button type="button" className="secondary-button" onClick={() => refreshServers().catch(() => {})}>Tentar novamente</button></div> : showServerEmpty ? <div className="server-welcome server-state-message"><Icon name="server" size={30} /><h2>Crie seu primeiro servidor</h2><p>Um espaço persistente para conversar com as pessoas que importam.</p><button type="button" className="primary-button" onClick={handleCreateServer}>Criar servidor</button></div> : visibleMessages.length ? visibleMessages.map(renderServerMessage) : messageQuery.trim() ? <div className="server-welcome server-state-message"><Icon name="search" size={30} /><h2>Nenhuma mensagem encontrada</h2><p>Tente outra palavra ou limpe a busca para voltar ao histórico.</p><button type="button" className="secondary-button" onClick={() => setMessageQuery("")}>Limpar busca</button></div> : <div className="server-welcome"><Icon name="hash" size={30} /><h2>Comece em #{activeChannel?.name || "geral"}</h2><p>Este é o início do histórico persistente deste canal.</p></div>}</ChatViewport>
      <div className="server-voice-audio-sinks" aria-hidden="true">{serverVoice.participants.filter((participant) => !participant.isLocal && !serverCallParticipants.some((visual) => visual.socketId === participant.socketId)).map((participant) => <AudioParticipant key={participant.socketId} peerSocketId={participant.socketId} stream={participant.stream || serverVoice.remoteStreams[participant.socketId]} volume={remoteVolumes[participant.socketId] ?? 100} isDeafened={isDeafened} />)}</div>
      {activeChannel?.type === "text" && <ChatComposerFrame onSubmit={sendMessage}>
        {replyingTo && <div className="server-replying"><span>Respondendo a {replyingTo.sender?.displayName || replyingTo.sender?.username || "mensagem"}</span><button type="button" className="icon-button" onClick={() => setReplyingTo(null)} aria-label="Cancelar resposta"><Icon name="close" size={13} /></button></div>}
        {selectedFile && <div className="selected-file"><span>{selectedFile.name} ({formatServerFileSize(selectedFile.size)})</span><button type="button" onClick={() => setSelectedFile(null)} aria-label="Remover anexo" title="Remover anexo"><Icon name="close" size={14} /></button></div>}
        {typingUsers.length > 0 && <div className="server-typing" role="status" aria-live="polite"><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>{typingUsers.length === 1 ? `${typingUsers[0].displayName} esta digitando` : `${typingUsers.length} pessoas estao digitando`}</div>}
        <ChatComposerRow>
          <button type="button" className="attach-button" onClick={() => { setIsAttachMenuOpen((current) => !current); setIsEmojiPickerOpen(false); }} disabled={isSending} title="Adicionar anexo" aria-label="Adicionar anexo" aria-haspopup="menu" aria-expanded={isAttachMenuOpen}><Icon name="plus" size={17} /></button>
          {isAttachMenuOpen && <div className="composer-popover attach-menu" role="menu" aria-label="Adicionar anexo"><button type="button" role="menuitem" onClick={() => openServerFilePicker(MEDIA_ACCEPT)}><Icon name="image" size={15} /><span>Enviar imagem ou vídeo</span></button><button type="button" role="menuitem" onClick={() => openServerFilePicker(FILE_ACCEPT)}><Icon name="file" size={15} /><span>Enviar arquivo</span></button></div>}
          <input ref={fileInputRef} className="visually-hidden" type="file" accept={fileAccept} onChange={handleServerFileChange} />
          <textarea ref={messageInputRef} className="message-input" value={draft} onChange={(event) => handleDraftChange(event.target.value)} onKeyDown={handleMessageKeyDown} placeholder={`Mensagem em #${activeChannel.name}`} maxLength={4000} rows={1} disabled={isSending} aria-label={`Mensagem para #${activeChannel.name}`} />
          <div className="composer-actions"><button type="button" className="composer-icon-button" onClick={() => { setIsEmojiPickerOpen((current) => !current); setIsAttachMenuOpen(false); }} disabled={isSending} title="Inserir emoji" aria-label="Inserir emoji" aria-expanded={isEmojiPickerOpen}><Icon name="smile" size={16} /></button>{(draft.trim() || selectedFile) && <button type="submit" className="send-button" disabled={isSending} aria-label={isSending ? "Enviando" : "Enviar mensagem"}><Icon name="send" size={15} /></button>}</div>
          {isEmojiPickerOpen && <div className="composer-popover"><EmojiPicker onSelect={insertServerEmoji} /></div>}
        </ChatComposerRow>
      </ChatComposerFrame>}
      </div>
    </section>}
    </section>
    <ParticipantsPanel heading="Membros" participants={memberParticipants} showMedia={false} showPresenceIndicator={false} onProfileClick={(person, anchorRect) => setProfileUser({ user: person || user, anchorRect })} onParticipantClick={(member, anchorRect) => setProfileUser({ user: member, anchorRect })} />
    {profileUser && <SocialUserProfilePopover participant={profileUser.user} anchorRect={profileUser.anchorRect} onClose={() => setProfileUser(null)} onViewProfile={(person) => { setProfileUser(null); setProfileDetailsUser(person); }} />}
    {profileDetailsUser && <SocialUserProfileModal userId={profileDetailsUser.id} initialUser={{ ...profileDetailsUser, status: profileDetailsUser.status || "online" }} onClose={() => setProfileDetailsUser(null)} />}
    {settingsOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !serverActionBusy) setSettingsOpen(false); }}>
      <section className="server-settings-modal" role="dialog" aria-modal="true" aria-labelledby="server-settings-title">
        <header className="server-settings-header"><div><span className="section-label">SERVIDOR</span><h2 id="server-settings-title">{canManageServer ? "Configuracoes do servidor" : "Perfil neste servidor"}</h2></div><button type="button" className="icon-button" onClick={() => setSettingsOpen(false)} disabled={serverActionBusy} aria-label="Fechar"><Icon name="close" size={18} /></button></header>
        <div className="server-settings-layout">
          <nav className="server-settings-nav" aria-label="Secoes do servidor">
            {canManageServer && <button type="button" className={settingsSection === "overview" ? "is-active" : ""} onClick={() => setSettingsSection("overview")}><Icon name="server" size={16} />Visao geral</button>}
            <button type="button" className={settingsSection === "identity" ? "is-active" : ""} onClick={() => setSettingsSection("identity")}><Icon name="user" size={16} />Perfil no servidor</button>
            {canManageServer && <button type="button" className={settingsSection === "channels" ? "is-active" : ""} onClick={() => setSettingsSection("channels")}><Icon name="hash" size={16} />Canais</button>}
            <span />
            <button type="button" className={settingsSection === "danger" ? "is-active danger-menu-item" : "danger-menu-item"} onClick={() => setSettingsSection("danger")}><Icon name={canDeleteServer ? "trash" : "leave"} size={16} />{canDeleteServer ? "Excluir servidor" : "Sair do servidor"}</button>
          </nav>
          <form id="server-settings-form" className="server-settings-content" onSubmit={submitServerSettings}>
            {settingsSection === "overview" && canManageServer && <section><span className="section-label">IDENTIDADE DO SERVIDOR</span><h3>Visao geral</h3><p>Nome e imagem aparecem na rail e no cabecalho do servidor.</p><div className="server-icon-editor"><div className="server-icon-preview">{settingsIconUrl ? <img src={settingsIconUrl} alt="" /> : (settingsName || "S").slice(0, 2).toUpperCase()}</div><div><label className="secondary-button server-icon-upload"><Icon name="image" size={15} />Alterar imagem<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectServerIcon(event, setSettingsIconUrl, setSettingsError)} /></label>{settingsIconUrl && <button type="button" className="text-button" onClick={() => setSettingsIconUrl("")}>Remover</button>}<small>PNG, JPEG ou WebP. Maximo 2 MB.</small></div></div><label className="field-label" htmlFor="server-settings-name">Nome do servidor</label><input id="server-settings-name" className="text-input" value={settingsName} onChange={(event) => { setSettingsName(event.target.value); setSettingsError(""); }} minLength={2} maxLength={60} aria-invalid={Boolean(settingsError)} /></section>}
            {settingsSection === "identity" && <section><span className="section-label">IDENTIDADE LOCAL</span><h3>Perfil neste servidor</h3><p>O apelido aparece apenas neste servidor. Deixe vazio para usar seu nome global.</p><div className="server-member-preview"><UserAvatar user={{ ...user, displayName: settingsNickname || user?.displayName }} size={48} /><div><strong>{settingsNickname || user?.displayName || user?.username}</strong><small>@{user?.username}</small></div></div><label className="field-label" htmlFor="server-settings-nickname">Apelido no servidor</label><input id="server-settings-nickname" className="text-input" value={settingsNickname} onChange={(event) => { setSettingsNickname(event.target.value); setSettingsError(""); }} maxLength={40} placeholder={user?.displayName || user?.username} /></section>}
            {settingsSection === "channels" && canManageServer && <section><div className="server-settings-section-row"><div><span className="section-label">ORGANIZACAO</span><h3>Canais</h3></div><button type="button" className="secondary-button" onClick={() => { setSettingsOpen(false); openCreateChannel("text"); }}><Icon name="plus" size={15} />Novo canal</button></div><p>Renomeie ou remova canais sem sair deste contexto.</p><div className="server-settings-channel-list">{(server?.channels || []).map((channel) => <div className="server-settings-channel-row" key={channel.id}><Icon name={channel.type === "voice" ? "voice" : "hash"} size={16} />{editingChannelId === channel.id ? <input className="text-input" value={editingChannelName} onChange={(event) => setEditingChannelName(event.target.value)} maxLength={40} autoFocus /> : <span><strong>{channel.name}</strong><small>{channel.type === "voice" ? "Voz" : "Texto"}</small></span>}<div>{editingChannelId === channel.id ? <><button type="button" className="icon-button" onClick={() => saveChannelName(channel)} title="Salvar" aria-label="Salvar nome"><Icon name="check" size={15} /></button><button type="button" className="icon-button" onClick={() => setEditingChannelId("")} title="Cancelar" aria-label="Cancelar"><Icon name="close" size={15} /></button></> : <><button type="button" className="icon-button" onClick={() => { setEditingChannelId(channel.id); setEditingChannelName(channel.name); }} title="Renomear" aria-label={`Renomear ${channel.name}`}><Icon name="edit" size={15} /></button><button type="button" className="icon-button danger-menu-item" onClick={() => removeChannel(channel)} title="Excluir" aria-label={`Excluir ${channel.name}`}><Icon name="trash" size={15} /></button></>}</div></div>)}</div></section>}
            {settingsSection === "danger" && <section className="server-settings-danger"><span className="section-label">ZONA DE RISCO</span><h3>{canDeleteServer ? "Excluir servidor" : "Sair do servidor"}</h3><p>{canDeleteServer ? "A exclusao remove canais, mensagens, membros e convites de forma permanente." : "Voce podera voltar depois com um novo convite."}</p><button type="button" className="danger-button" onClick={() => { setSettingsOpen(false); canDeleteServer ? openDeleteServer() : openLeaveServer(); }}>{canDeleteServer ? "Excluir servidor" : "Sair do servidor"}</button></section>}
            {settingsError && <small className="field-error" role="alert">{settingsError}</small>}
          </form>
        </div>
        {!["channels", "danger"].includes(settingsSection) && <footer><button type="button" className="secondary-button" onClick={() => setSettingsOpen(false)} disabled={serverActionBusy}>Cancelar</button><button type="submit" form="server-settings-form" className="primary-button" disabled={serverActionBusy || (canManageServer && settingsName.trim().length < 2)}>{serverActionBusy ? "Salvando..." : "Salvar alteracoes"}</button></footer>}
      </section>
    </div>}
    {inviteOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-invite-title"><header><div><span className="section-label">CONVITE</span><h2 id="server-invite-title">Convidar para {server?.name}</h2></div><button type="button" className="icon-button" onClick={() => setInviteOpen(false)} aria-label="Fechar"><Icon name="close" size={16} /></button></header>{inviteError ? <p className="field-error">{inviteError}</p> : inviteLink ? <><label className="field-label" htmlFor="server-invite-link">Link de convite</label><input id="server-invite-link" className="text-input" value={inviteLink} readOnly onFocus={(event) => event.target.select()} /><footer><button type="button" className="secondary-button" onClick={() => setInviteOpen(false)}>Fechar</button><button type="button" className="primary-button" onClick={copyServerInvite}>Copiar convite</button></footer></> : <p>Gerando um convite...</p>}</section></div>}
    {leaveOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !serverActionBusy) setLeaveOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-leave-title"><header><div><span className="section-label">MEMBRESIA</span><h2 id="server-leave-title">Sair do servidor</h2></div><button type="button" className="icon-button" onClick={() => setLeaveOpen(false)} disabled={serverActionBusy} aria-label="Fechar"><Icon name="close" size={16} /></button></header>{server?.role === "owner" ? <p>Transfira a propriedade ou exclua o servidor antes de sair.</p> : <p>Sair de <strong>{server?.name}</strong>? Você poderá voltar usando um convite.</p>}<footer><button type="button" className="secondary-button" onClick={() => setLeaveOpen(false)} disabled={serverActionBusy}>Cancelar</button>{server?.role !== "owner" && <button type="button" className="primary-button" onClick={confirmLeaveServer} disabled={serverActionBusy}>{serverActionBusy ? "Saindo..." : "Sair do servidor"}</button>}</footer></section></div>}
    {deleteOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !serverActionBusy) setDeleteOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-delete-title"><header><div><span className="section-label">AÇÃO PERMANENTE</span><h2 id="server-delete-title">Excluir servidor?</h2></div><button type="button" className="icon-button" onClick={() => setDeleteOpen(false)} disabled={serverActionBusy} aria-label="Fechar"><Icon name="close" size={16} /></button></header><p>Você está prestes a excluir permanentemente: <strong>{server?.name}</strong>. Canais, mensagens, membros, convites e configurações serão removidos. Esta ação não pode ser desfeita.</p><form id="server-delete-form" onSubmit={(event) => { event.preventDefault(); confirmDeleteServer(); }}><label className="field-label" htmlFor="server-delete-name">Digite o nome do servidor para confirmar:</label><input id="server-delete-name" className="text-input" value={deleteName} onChange={(event) => { setDeleteName(event.target.value); setDeleteError(""); }} autoFocus aria-invalid={Boolean(deleteError)} />{deleteError && <small className="field-error">{deleteError}</small>}</form><footer><button type="button" className="secondary-button" onClick={() => setDeleteOpen(false)} disabled={serverActionBusy}>Cancelar</button><button type="submit" form="server-delete-form" className="primary-button danger-action-button" disabled={serverActionBusy || deleteName !== server?.name}>{serverActionBusy ? "Excluindo..." : "Excluir servidor"}</button></footer></section></div>}
    {channelOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !serverActionBusy) setChannelOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-channel-title"><header><div><span className="section-label">CANAIS</span><h2 id="server-channel-title">Criar canal</h2></div><button type="button" className="icon-button" onClick={() => setChannelOpen(false)} disabled={serverActionBusy} aria-label="Fechar"><Icon name="close" size={16} /></button></header><form id="server-channel-form" onSubmit={submitCreateChannel}><label className="field-label" htmlFor="server-channel-name">Nome</label><input id="server-channel-name" className="text-input" value={channelName} onChange={(event) => { setChannelName(event.target.value); setChannelError(""); }} maxLength={40} autoFocus aria-invalid={Boolean(channelError)} /><label className="field-label" htmlFor="server-channel-type">Tipo</label><select id="server-channel-type" className="text-input" value={channelType} onChange={(event) => setChannelType(event.target.value)}><option value="text">Texto</option><option value="voice">Voz</option></select>{channelError && <small className="field-error">{channelError}</small>}</form><footer><button type="button" className="secondary-button" onClick={() => setChannelOpen(false)} disabled={serverActionBusy}>Cancelar</button><button type="submit" form="server-channel-form" className="primary-button" disabled={serverActionBusy || !channelName.trim()}>{serverActionBusy ? "Criando..." : "Criar"}</button></footer></section></div>}
    {createOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setCreateOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-create-title"><header><div><span className="section-label">NOVO ESPACO</span><h2 id="server-create-title">Criar servidor</h2></div><button type="button" className="icon-button" onClick={() => setCreateOpen(false)} disabled={creating} aria-label="Fechar"><Icon name="close" size={16} /></button></header><p>Crie um espaco persistente para reunir suas conversas.</p><form id="server-create-form" onSubmit={submitCreateServer}><div className="server-icon-editor"><div className="server-icon-preview">{createIconUrl ? <img src={createIconUrl} alt="" /> : (createName || "S").slice(0, 2).toUpperCase()}</div><div><label className="secondary-button server-icon-upload"><Icon name="image" size={15} />Escolher imagem<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectServerIcon(event, setCreateIconUrl, setCreateError)} /></label>{createIconUrl && <button type="button" className="text-button" onClick={() => setCreateIconUrl("")}>Remover</button>}</div></div><label className="field-label" htmlFor="server-create-name">Nome do servidor</label><input id="server-create-name" className="text-input" value={createName} onChange={(event) => { setCreateName(event.target.value); if (createError) setCreateError(""); }} placeholder="Ex.: Estudos" minLength={2} maxLength={60} autoFocus aria-invalid={Boolean(createError)} />{createError && <small className="field-error">{createError}</small>}</form><footer><button type="button" className="secondary-button" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</button><button type="submit" form="server-create-form" className="primary-button" disabled={creating || createName.trim().length < 2}>{creating ? "Criando..." : "Criar servidor"}</button></footer></section></div>}
    {lightboxImage && <div className="dm-lightbox server-lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxImage(null); }}><button type="button" className="icon-button dm-lightbox-close" onClick={() => setLightboxImage(null)} aria-label="Fechar imagem" title="Fechar"><Icon name="close" size={20} /></button><img src={lightboxImage.source} alt={lightboxImage.alt || "Imagem ampliada"} /></div>}
    <ToastStack toasts={toasts} />
  </main>;
}

function updateReactionList(reactions = [], emoji, active) {
  const current = reactions.find((reaction) => reaction.emoji === emoji);
  if (active) return current ? reactions.map((reaction) => reaction.emoji === emoji ? { ...reaction, count: reaction.count + 1, reacted: true } : reaction) : [...reactions, { emoji, count: 1, reacted: true }];
  if (!current || current.count <= 1) return reactions.filter((reaction) => reaction.emoji !== emoji);
  return reactions.map((reaction) => reaction.emoji === emoji ? { ...reaction, count: reaction.count - 1, reacted: false } : reaction);
}

function ServerLoadingState() {
  return <div className="server-state-message server-loading-state"><span className="loading-sheen" /><h2>Carregando servidor...</h2><p>Buscando canais, mensagens e participantes.</p></div>;
}
