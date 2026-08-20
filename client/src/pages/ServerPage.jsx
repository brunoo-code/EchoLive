import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import Icon from "../components/Icon.jsx";
import RoomRail from "../components/RoomRail.jsx";
import Sidebar from "../components/Sidebar.jsx";
import ParticipantsPanel from "../components/ParticipantsPanel.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import { ChatComposerFrame, ChatComposerRow, ChatHeader, ChatViewport } from "../components/ChatFrame.jsx";
import SocialUserProfileModal from "../components/SocialUserProfileModal.jsx";
import AudioParticipant from "../components/AudioParticipant.jsx";
import ToastStack from "../components/ToastStack.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useServers } from "../servers/ServerContext.jsx";
import { SERVER_URL } from "../utils/webrtc.js";
import useServerVoiceCall from "../hooks/useServerVoiceCall.js";
import useToasts from "../hooks/useToasts.js";

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

export default function ServerPage({ serverId, onNavigateHome, onNavigateSocial, onNavigateServer }) {
  const { user, isAuthenticated } = useAuth();
  const { servers, createServer, deleteServer, leaveServer, refreshServers, status: serversStatus, updateServer } = useServers();
  const { toasts, notify } = useToasts();
  const [server, setServer] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState("");
  const [voiceChannelId, setVoiceChannelId] = useState("");
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [serverLoading, setServerLoading] = useState(Boolean(serverId));
  const [serverNotFound, setServerNotFound] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
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
  const [serverActionBusy, setServerActionBusy] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [streamPreset, setStreamPreset] = useState("720p30");
  const socketRef = useRef(null);
  const [serverSocket, setServerSocket] = useState(null);

  const activeChannel = useMemo(() => server?.channels?.find((channel) => channel.id === activeChannelId) || server?.channels?.find((channel) => channel.type === "text") || null, [activeChannelId, server]);
  const textChannels = server?.channels?.filter((channel) => channel.type === "text") || [];
  const voiceChannels = server?.channels?.filter((channel) => channel.type === "voice") || [];
  const memberParticipants = useMemo(() => members.map((member) => ({
    ...member,
    socketId: `server-member-${member.id}`,
    nickname: member.displayName || member.username,
    displayName: member.displayName || member.username,
    status: member.status || "online",
    isLocal: member.id === user?.id,
    secondaryText: member.role === "owner" ? "Proprietário" : member.role === "admin" ? "Administrador" : "Membro",
    rawUser: member
  })), [members, user?.id]);
  const voiceIdentity = user ? { id: user.id, userId: user.id, displayName: user.displayName || user.username, username: user.username, avatarUrl: user.avatarUrl || "", badges: user.badges || [] } : null;
  const serverVoice = useServerVoiceCall({ socket: serverSocket, serverId, channelId: voiceChannelId, identity: voiceIdentity, enabled: Boolean(voiceChannelId), notify });
  const canManageServer = ["owner", "admin"].includes(server?.role);
  const canDeleteServer = server?.role === "owner";

  useEffect(() => {
    if (!serverVoice.connected) setIsDeafened(false);
  }, [serverVoice.connected]);

  function toggleDeafen() {
    setIsDeafened((current) => !current);
  }

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
    request(`/api/servers/${serverId}/channels/${activeChannel.id}/messages`).then((data) => { if (active) setMessages(data.messages || []); }).catch((requestError) => { if (active) setError(requestError.message); });
    const subscribe = () => serverSocket.emit("server:subscribe", { serverId, channelId: activeChannel.id });
    const handleMessage = (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    const handleReaction = ({ messageId, emoji, active: reactionActive }) => setMessages((current) => current.map((message) => message.id !== messageId ? message : { ...message, reactions: updateReactionList(message.reactions, emoji, reactionActive) }));
    if (serverSocket.connected) subscribe();
    else serverSocket.once("connect", subscribe);
    serverSocket.on("server:message-created", handleMessage);
    serverSocket.on("server:reaction-updated", handleReaction);
    return () => {
      active = false;
      serverSocket.emit("server:unsubscribe", { serverId, channelId: activeChannel.id });
      serverSocket.off("connect", subscribe);
      serverSocket.off("server:message-created", handleMessage);
      serverSocket.off("server:reaction-updated", handleReaction);
    };
  }, [activeChannel?.id, isAuthenticated, serverId, serverSocket]);

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
      const created = await createServer({ name });
      setCreateOpen(false);
      setCreateName("");
      onNavigateServer?.(created.id);
    } catch (requestError) {
      setCreateError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  function openServerSettings() {
    setSettingsName(server?.name || "");
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
      const updated = await updateServer(serverId, { name });
      setServer(updated);
      setSettingsOpen(false);
      notify("Servidor renomeado.");
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

  function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !serverId || !activeChannel?.id) return;
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("server:message", { serverId, channelId: activeChannel.id, content, replyToMessageId: replyingTo?.id }, (result) => { if (!result?.ok) setError(result?.error || "Nao foi possivel enviar a mensagem."); });
    } else {
      request(`/api/servers/${serverId}/channels/${activeChannel.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, replyToMessageId: replyingTo?.id })
      }).then((data) => setMessages((current) => current.some((item) => item.id === data.message.id) ? current : [...current, data.message])).catch((requestError) => setError(requestError.message));
    }
    setDraft("");
    setReplyingTo(null);
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
    setVoiceChannelId((current) => current === channelId ? "" : channelId);
  }

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

  if (!isAuthenticated) return <main className="page server-page server-page-gate"><section className="social-guest-gate"><Icon name="lock" size={24} /><h1>Servidores ficam com a sua conta.</h1><p>Entre ou crie uma conta para manter seus servidores, canais e mensagens por aqui.</p><button type="button" className="primary-button" onClick={onNavigateHome}>Voltar para a Home</button></section></main>;

  const serverSidebarState = server ? null : showServerLoading || showServerListLoading ? <div className="server-empty server-loading-state"><span className="loading-sheen" /><strong>Carregando servidor...</strong><span>Buscando canais e participantes.</span></div> : <div className="server-empty"><Icon name={serverNotFound || showServerListError ? "alert" : "server"} size={24} /><strong>{serverNotFound ? "Servidor não encontrado" : showServerListError ? "Não foi possível carregar" : "Crie seu primeiro servidor"}</strong><span>{serverNotFound ? "Esse servidor não está disponível para sua conta." : showServerListError ? "Tente novamente para carregar seus servidores." : "Um espaço persistente para suas conversas."}</span>{showServerListError ? <button type="button" className="secondary-button" onClick={() => refreshServers().catch(() => {})}>Tentar novamente</button> : <button type="button" className="primary-button" onClick={handleCreateServer}>Criar servidor</button>}</div>;

  return <main className="page app-shell room-page server-page">
    <RoomRail roomCode="" roomName="" recentRooms={[]} onHome={onNavigateHome} onSocial={onNavigateSocial} onOpenSwitcher={handleCreateServer} servers={servers} activeServerId={serverId} onOpenServer={onNavigateServer} onCreateServer={handleCreateServer} />
    <Sidebar variant="server" serverName={server?.name || "Seus servidores"} serverTextChannels={textChannels} serverVoiceChannels={voiceChannels} serverActiveChannelId={activeChannel?.id} serverVoiceChannelId={voiceChannelId} voiceChannelName={voiceChannels.find((channel) => channel.id === voiceChannelId)?.name || voiceChannels[0]?.name || "Geral"} onSelectServerChannel={setActiveChannelId} onToggleServerVoice={toggleVoice} serverVoiceParticipants={serverVoice.participants} serverNavigationState={serverSidebarState} nickname={user?.displayName || user?.username || "Conta"} status="online" avatarUrl={user?.avatarUrl || ""} avatarVariant={user?.avatarVariant || 0} isInVoice={serverVoice.connected} connectionQuality="Boa" micEnabled={serverVoice.micEnabled} cameraEnabled={serverVoice.cameraEnabled} isScreenSharing={serverVoice.isScreenSharing} streamPreset={streamPreset} screenShareLabel={streamPreset.replace("p", "p · ").replace("30", "30 FPS").replace("60", "60 FPS")} onStreamPresetChange={setStreamPreset} isDeafened={isDeafened} onProfileClick={() => setProfileUser(user)} onToggleMicrophone={serverVoice.toggleMicrophone} onToggleCamera={serverVoice.toggleCamera} onToggleScreenShare={serverVoice.toggleScreenShare} onToggleDeafen={toggleDeafen} onLeaveVoice={serverVoice.leave} onJoinVoice={() => voiceChannels[0] && toggleVoice(voiceChannels[0].id)} onLeaveRoom={onNavigateHome} onServerInvite={canManageServer ? openServerInvite : undefined} onServerSettings={canManageServer ? openServerSettings : undefined} onServerLeave={server ? openLeaveServer : undefined} onServerDelete={canDeleteServer ? openDeleteServer : undefined} canManageServer={canManageServer} canDeleteServer={canDeleteServer} onCreateServerChannel={canManageServer ? openCreateChannel : undefined} />
    <section className="central-stage chat-stage">
      <div className="chat-stage-inner">
      <ChatHeader title={activeChannel?.name || (showServerEmpty ? "Seus servidores" : "Selecione um canal")} subtitle={server ? `${server.memberCount} membro${server.memberCount === 1 ? "" : "s"}` : ""} type={activeChannel?.type === "voice" ? "voice" : "text"} />
      {error && <div className="server-error" role="alert">{error}<button type="button" className="icon-button" onClick={() => setError("")} aria-label="Fechar aviso"><Icon name="close" size={14} /></button></div>}
       <ChatViewport>{showServerLoading || showServerListLoading ? <ServerLoadingState /> : serverNotFound ? <div className="server-welcome server-state-message"><Icon name="alert" size={30} /><h2>Servidor indisponível</h2><p>Verifique o endereço ou volte para a lista de servidores.</p><button type="button" className="secondary-button" onClick={() => onNavigateServer?.("")}>Voltar aos servidores</button></div> : showServerListError ? <div className="server-welcome server-state-message"><Icon name="alert" size={30} /><h2>Não foi possível carregar</h2><p>O shell está pronto, mas a lista de servidores não respondeu.</p><button type="button" className="secondary-button" onClick={() => refreshServers().catch(() => {})}>Tentar novamente</button></div> : showServerEmpty ? <div className="server-welcome server-state-message"><Icon name="server" size={30} /><h2>Crie seu primeiro servidor</h2><p>Um espaço persistente para conversar com as pessoas que importam.</p><button type="button" className="primary-button" onClick={handleCreateServer}>Criar servidor</button></div> : messages.length ? messages.map((message) => <article className="chat-message" key={message.id}><button type="button" className="message-avatar server-message-avatar" onClick={() => setProfileUser(message.sender)} aria-label={`Ver perfil de ${message.sender.displayName || message.sender.username}`}><UserAvatar user={message.sender} size={30} /></button><div className="message-body"><div className="message-meta"><strong>{message.sender.displayName || message.sender.username}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("pt-BR")}</time><button type="button" className="server-reply-button" onClick={() => setReplyingTo(message)} title="Responder" aria-label="Responder"><Icon name="reply" size={13} /></button></div>{message.replyToMessageId && <small className="server-reply-ref">Respondendo a uma mensagem</small>}{message.deletedAt ? <p className="server-message-deleted">Mensagem removida.</p> : <p>{message.content}</p>}{!message.deletedAt && <div className="server-message-reactions">{(message.reactions || []).map((reaction) => <button type="button" key={reaction.emoji} className={reaction.reacted ? "is-active" : ""} onClick={() => toggleReaction(message.id, reaction.emoji)}>{reaction.emoji} <small>{reaction.count}</small></button>)}<button type="button" onClick={() => toggleReaction(message.id, "👍")} title="Adicionar reação" aria-label="Adicionar reação">+</button></div>}</div></article>) : <div className="server-welcome"><Icon name="hash" size={30} /><h2>Comece em #{activeChannel?.name || "geral"}</h2><p>Este é o início do histórico persistente deste canal.</p></div>}</ChatViewport>
      <div className="server-voice-audio-sinks" aria-hidden="true">{serverVoice.participants.filter((participant) => !participant.isLocal).map((participant) => <AudioParticipant key={participant.socketId} peerSocketId={participant.socketId} stream={participant.stream || serverVoice.remoteStreams[participant.socketId]} volume={100} isDeafened={isDeafened} />)}</div>
      {activeChannel?.type === "text" && <ChatComposerFrame onSubmit={sendMessage}>{replyingTo && <div className="server-replying"><span>Respondendo a {replyingTo.sender.displayName || replyingTo.sender.username}</span><button type="button" className="icon-button" onClick={() => setReplyingTo(null)} aria-label="Cancelar resposta"><Icon name="close" size={13} /></button></div>}<ChatComposerRow><button type="button" className="icon-button" title="Anexos indisponíveis nesta primeira camada" aria-label="Anexos indisponíveis"><Icon name="plus" size={18} /></button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Conversar em #${activeChannel.name}`} maxLength={4000} /><button type="submit" className="icon-button is-send" title="Enviar mensagem" aria-label="Enviar mensagem"><Icon name="send" size={16} /></button></ChatComposerRow></ChatComposerFrame>}
      </div>
    </section>
    <ParticipantsPanel heading="Membros" participants={memberParticipants} showMedia={false} onProfileClick={() => setProfileUser(user)} onParticipantClick={(member) => setProfileUser(member.rawUser || member)} />
    {profileUser && <SocialUserProfileModal userId={profileUser.id} initialUser={{ ...profileUser, status: "online" }} onClose={() => setProfileUser(null)} />}
    {settingsOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !serverActionBusy) setSettingsOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-settings-title"><header><div><span className="section-label">SERVIDOR</span><h2 id="server-settings-title">Configurações do servidor</h2></div><button type="button" className="icon-button" onClick={() => setSettingsOpen(false)} disabled={serverActionBusy} aria-label="Fechar"><Icon name="close" size={16} /></button></header><form id="server-settings-form" onSubmit={submitServerSettings}><label className="field-label" htmlFor="server-settings-name">Nome do servidor</label><input id="server-settings-name" className="text-input" value={settingsName} onChange={(event) => { setSettingsName(event.target.value); setSettingsError(""); }} minLength={2} maxLength={60} autoFocus aria-invalid={Boolean(settingsError)} />{settingsError && <small className="field-error">{settingsError}</small>}</form><footer><button type="button" className="secondary-button" onClick={() => setSettingsOpen(false)} disabled={serverActionBusy}>Cancelar</button><button type="submit" form="server-settings-form" className="primary-button" disabled={serverActionBusy || settingsName.trim().length < 2}>{serverActionBusy ? "Salvando..." : "Salvar"}</button></footer></section></div>}
    {inviteOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-invite-title"><header><div><span className="section-label">CONVITE</span><h2 id="server-invite-title">Convidar para {server?.name}</h2></div><button type="button" className="icon-button" onClick={() => setInviteOpen(false)} aria-label="Fechar"><Icon name="close" size={16} /></button></header>{inviteError ? <p className="field-error">{inviteError}</p> : inviteLink ? <><label className="field-label" htmlFor="server-invite-link">Link de convite</label><input id="server-invite-link" className="text-input" value={inviteLink} readOnly onFocus={(event) => event.target.select()} /><footer><button type="button" className="secondary-button" onClick={() => setInviteOpen(false)}>Fechar</button><button type="button" className="primary-button" onClick={copyServerInvite}>Copiar convite</button></footer></> : <p>Gerando um convite...</p>}</section></div>}
    {leaveOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !serverActionBusy) setLeaveOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-leave-title"><header><div><span className="section-label">MEMBRESIA</span><h2 id="server-leave-title">Sair do servidor</h2></div><button type="button" className="icon-button" onClick={() => setLeaveOpen(false)} disabled={serverActionBusy} aria-label="Fechar"><Icon name="close" size={16} /></button></header>{server?.role === "owner" ? <p>Transfira a propriedade ou exclua o servidor antes de sair.</p> : <p>Sair de <strong>{server?.name}</strong>? Você poderá voltar usando um convite.</p>}<footer><button type="button" className="secondary-button" onClick={() => setLeaveOpen(false)} disabled={serverActionBusy}>Cancelar</button>{server?.role !== "owner" && <button type="button" className="primary-button" onClick={confirmLeaveServer} disabled={serverActionBusy}>{serverActionBusy ? "Saindo..." : "Sair do servidor"}</button>}</footer></section></div>}
    {deleteOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !serverActionBusy) setDeleteOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-delete-title"><header><div><span className="section-label">AÇÃO PERMANENTE</span><h2 id="server-delete-title">Excluir servidor?</h2></div><button type="button" className="icon-button" onClick={() => setDeleteOpen(false)} disabled={serverActionBusy} aria-label="Fechar"><Icon name="close" size={16} /></button></header><p>Você está prestes a excluir permanentemente: <strong>{server?.name}</strong>. Canais, mensagens, membros, convites e configurações serão removidos. Esta ação não pode ser desfeita.</p><form id="server-delete-form" onSubmit={(event) => { event.preventDefault(); confirmDeleteServer(); }}><label className="field-label" htmlFor="server-delete-name">Digite o nome do servidor para confirmar:</label><input id="server-delete-name" className="text-input" value={deleteName} onChange={(event) => { setDeleteName(event.target.value); setDeleteError(""); }} autoFocus aria-invalid={Boolean(deleteError)} />{deleteError && <small className="field-error">{deleteError}</small>}</form><footer><button type="button" className="secondary-button" onClick={() => setDeleteOpen(false)} disabled={serverActionBusy}>Cancelar</button><button type="submit" form="server-delete-form" className="primary-button danger-action-button" disabled={serverActionBusy || deleteName !== server?.name}>{serverActionBusy ? "Excluindo..." : "Excluir servidor"}</button></footer></section></div>}
    {channelOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !serverActionBusy) setChannelOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-channel-title"><header><div><span className="section-label">CANAIS</span><h2 id="server-channel-title">Criar canal</h2></div><button type="button" className="icon-button" onClick={() => setChannelOpen(false)} disabled={serverActionBusy} aria-label="Fechar"><Icon name="close" size={16} /></button></header><form id="server-channel-form" onSubmit={submitCreateChannel}><label className="field-label" htmlFor="server-channel-name">Nome</label><input id="server-channel-name" className="text-input" value={channelName} onChange={(event) => { setChannelName(event.target.value); setChannelError(""); }} maxLength={40} autoFocus aria-invalid={Boolean(channelError)} /><label className="field-label" htmlFor="server-channel-type">Tipo</label><select id="server-channel-type" className="text-input" value={channelType} onChange={(event) => setChannelType(event.target.value)}><option value="text">Texto</option><option value="voice">Voz</option></select>{channelError && <small className="field-error">{channelError}</small>}</form><footer><button type="button" className="secondary-button" onClick={() => setChannelOpen(false)} disabled={serverActionBusy}>Cancelar</button><button type="submit" form="server-channel-form" className="primary-button" disabled={serverActionBusy || !channelName.trim()}>{serverActionBusy ? "Criando..." : "Criar"}</button></footer></section></div>}
    {createOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setCreateOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-create-title"><header><div><span className="section-label">NOVO ESPAÇO</span><h2 id="server-create-title">Criar servidor</h2></div><button type="button" className="icon-button" onClick={() => setCreateOpen(false)} disabled={creating} aria-label="Fechar"><Icon name="close" size={16} /></button></header><p>Crie um espaço persistente para reunir suas conversas.</p><form id="server-create-form" onSubmit={submitCreateServer}><label className="field-label" htmlFor="server-create-name">Nome do servidor</label><input id="server-create-name" className="text-input" value={createName} onChange={(event) => { setCreateName(event.target.value); if (createError) setCreateError(""); }} placeholder="Ex.: Estudos" minLength={2} maxLength={60} autoFocus aria-invalid={Boolean(createError)} />{createError && <small className="field-error">{createError}</small>}<div className="server-create-note"><Icon name="info" size={15} /><span>A imagem do servidor poderá ser adicionada quando estiver persistida na conta.</span></div></form><footer><button type="button" className="secondary-button" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</button><button type="submit" form="server-create-form" className="primary-button" disabled={creating || createName.trim().length < 2}>{creating ? "Criando..." : "Criar servidor"}</button></footer></section></div>}
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
