import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import Icon from "../components/Icon.jsx";
import RoomRail from "../components/RoomRail.jsx";
import SocialUserProfileModal from "../components/SocialUserProfileModal.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import UserBadges from "../components/UserBadges.jsx";
import AudioParticipant from "../components/AudioParticipant.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useServers } from "../servers/ServerContext.jsx";
import { SERVER_URL } from "../utils/webrtc.js";
import useServerVoiceCall from "../hooks/useServerVoiceCall.js";

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
  const { servers, createServer, refreshServers, status: serversStatus } = useServers();
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
  const [voiceOptionsOpen, setVoiceOptionsOpen] = useState(false);
  const socketRef = useRef(null);
  const [serverSocket, setServerSocket] = useState(null);

  const activeChannel = useMemo(() => server?.channels?.find((channel) => channel.id === activeChannelId) || server?.channels?.find((channel) => channel.type === "text") || null, [activeChannelId, server]);
  const textChannels = server?.channels?.filter((channel) => channel.type === "text") || [];
  const voiceChannels = server?.channels?.filter((channel) => channel.type === "voice") || [];
  const voiceChannel = voiceChannels.find((channel) => channel.id === voiceChannelId) || null;
  const voiceIdentity = user ? { id: user.id, userId: user.id, displayName: user.displayName || user.username, username: user.username, avatarUrl: user.avatarUrl || "", badges: user.badges || [] } : null;
  const serverVoice = useServerVoiceCall({ socket: serverSocket, serverId, channelId: voiceChannelId, identity: voiceIdentity, enabled: Boolean(voiceChannelId), notify: setError });

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
    if (!serverId || !activeChannel?.id || activeChannel.type !== "text") return undefined;
    let active = true;
    setActiveChannelId(activeChannel.id);
    request(`/api/servers/${serverId}/channels/${activeChannel.id}/messages`).then((data) => { if (active) setMessages(data.messages || []); }).catch((requestError) => { if (active) setError(requestError.message); });
    const socket = io(SERVER_URL, { withCredentials: true });
    socketRef.current = socket;
    setServerSocket(socket);
    socket.on("connect", () => socket.emit("server:subscribe", { serverId, channelId: activeChannel.id }));
    socket.on("server:message-created", (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]));
    socket.on("server:reaction-updated", ({ messageId, emoji, active: reactionActive }) => setMessages((current) => current.map((message) => message.id !== messageId ? message : { ...message, reactions: updateReactionList(message.reactions, emoji, reactionActive) })));
    return () => { active = false; socket.emit("server:unsubscribe", { serverId, channelId: activeChannel.id }); socket.disconnect(); socketRef.current = null; setServerSocket(null); setVoiceChannelId(""); };
  }, [activeChannel?.id, serverId]);

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

  useEffect(() => {
    if (!createOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !creating) setCreateOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createOpen, creating]);

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
    setVoiceOptionsOpen(false);
    setVoiceChannelId((current) => current === channelId ? "" : channelId);
  }

  if (!isAuthenticated) return <main className="page server-page server-page-gate"><section className="social-guest-gate"><Icon name="lock" size={24} /><h1>Servidores ficam com a sua conta.</h1><p>Entre ou crie uma conta para manter seus servidores, canais e mensagens por aqui.</p><button type="button" className="primary-button" onClick={onNavigateHome}>Voltar para a Home</button></section></main>;

  const showServerLoading = Boolean(serverId && serverLoading);
  const showServerListLoading = !serverId && (serversStatus === "idle" || serversStatus === "loading");
  const showServerListError = !serverId && serversStatus === "error";
  const showServerEmpty = !serverId && serversStatus === "ready" && !servers.length;

  return <main className="page app-shell room-page server-page">
    <RoomRail roomCode="" roomName="" recentRooms={[]} onHome={onNavigateHome} onSocial={onNavigateSocial} onOpenSwitcher={handleCreateServer} servers={servers} activeServerId={serverId} onOpenServer={onNavigateServer} onCreateServer={handleCreateServer} />
    <aside className="app-sidebar server-sidebar">
      <header className="server-sidebar-header"><div><span className="section-label">SERVIDOR</span><strong>{server?.name || "Seus servidores"}</strong></div><button type="button" className="icon-button" onClick={handleCreateServer} title="Criar servidor" aria-label="Criar servidor" disabled={creating}><Icon name="plus" size={16} /></button></header>
       {server ? <div className="server-channel-list"><ChannelGroup title="Canais de texto" channels={textChannels} activeChannelId={activeChannel?.id} onSelect={setActiveChannelId} /><ChannelGroup title="Canais de voz" channels={voiceChannels} activeChannelId={voiceChannelId} onSelect={toggleVoice} voiceParticipants={serverVoice.participants} /></div> : showServerLoading || showServerListLoading ? <div className="server-empty server-loading-state"><span className="loading-sheen" /><strong>Carregando servidor...</strong><span>Buscando canais e participantes.</span></div> : <div className="server-empty"><Icon name={serverNotFound || showServerListError ? "alert" : "server"} size={24} /><strong>{serverNotFound ? "Servidor não encontrado" : showServerListError ? "Não foi possível carregar" : "Crie seu primeiro servidor"}</strong><span>{serverNotFound ? "Esse servidor não está disponível para sua conta." : showServerListError ? "Tente novamente para carregar seus servidores." : "Um espaço persistente para suas conversas."}</span>{showServerListError ? <button type="button" className="secondary-button" onClick={() => refreshServers().catch(() => {})}>Tentar novamente</button> : <button type="button" className="primary-button" onClick={handleCreateServer}>Criar servidor</button>}</div>}
       {serverVoice.connected && <section className="server-voice-footer" aria-label="Voz conectada"><div className="server-voice-heading"><span><Icon name="voice" size={15} /><strong>Voz conectada</strong><small>{voiceChannel?.name || "Geral"}</small></span><button type="button" className="icon-button" onClick={() => { setVoiceOptionsOpen(false); setVoiceChannelId(""); }} title="Desconectar voz" aria-label="Desconectar voz"><Icon name="phoneDisconnect" size={15} /></button></div><div className="server-voice-controls"><button type="button" className={`icon-button ${serverVoice.cameraEnabled ? "is-active" : ""}`} onClick={serverVoice.toggleCamera} title="Câmera" aria-label="Câmera"><Icon name="camera" size={15} /></button><button type="button" className={`icon-button ${serverVoice.isScreenSharing ? "is-active" : ""}`} onClick={serverVoice.toggleScreenShare} title="Compartilhar tela" aria-label="Compartilhar tela"><Icon name="screenShare" size={15} /></button><button type="button" className={`icon-button ${serverVoice.micEnabled ? "is-active" : ""}`} onClick={serverVoice.toggleMicrophone} title={serverVoice.micEnabled ? "Silenciar microfone" : "Ativar microfone"} aria-label={serverVoice.micEnabled ? "Silenciar microfone" : "Ativar microfone"}><Icon name="mic" size={15} /></button><div className="server-voice-options"><button type="button" className={`icon-button ${voiceOptionsOpen ? "is-active" : ""}`} onClick={() => setVoiceOptionsOpen((value) => !value)} title="Opções de voz" aria-label="Opções de voz" aria-expanded={voiceOptionsOpen} aria-haspopup="menu"><Icon name="settings" size={15} /></button>{voiceOptionsOpen && <div className="server-voice-options-menu" role="menu" aria-label="Opções de voz"><button type="button" onClick={serverVoice.toggleMicrophone} role="menuitem"><Icon name="mic" size={13} />{serverVoice.micEnabled ? "Silenciar microfone" : "Ativar microfone"}</button><button type="button" onClick={serverVoice.toggleCamera} role="menuitem"><Icon name="camera" size={13} />{serverVoice.cameraEnabled ? "Desativar câmera" : "Ativar câmera"}</button><button type="button" onClick={serverVoice.toggleScreenShare} role="menuitem"><Icon name="screenShare" size={13} />{serverVoice.isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}</button></div>}</div></div></section>}
       <div className="server-sidebar-footer"><UserAvatar user={user} size={30} /><span><strong>{user.displayName || user.username}</strong><small>@{user.username}</small></span></div>
    </aside>
    <section className="central-stage server-main">
      <header className="server-main-header"><div><span className="channel-kind"><Icon name={activeChannel?.type === "voice" ? "voice" : "hash"} size={17} /></span><strong>{activeChannel?.name || (showServerEmpty ? "Seus servidores" : "Selecione um canal")}</strong></div><span>{server ? `${server.memberCount} membro${server.memberCount === 1 ? "" : "s"}` : ""}</span></header>
      {error && <div className="server-error" role="alert">{error}<button type="button" className="icon-button" onClick={() => setError("")} aria-label="Fechar aviso"><Icon name="close" size={14} /></button></div>}
       <div className="server-message-list">{showServerLoading || showServerListLoading ? <ServerLoadingState /> : serverNotFound ? <div className="server-welcome server-state-message"><Icon name="alert" size={30} /><h2>Servidor indisponível</h2><p>Verifique o endereço ou volte para a lista de servidores.</p><button type="button" className="secondary-button" onClick={() => onNavigateServer?.("")}>Voltar aos servidores</button></div> : showServerListError ? <div className="server-welcome server-state-message"><Icon name="alert" size={30} /><h2>Não foi possível carregar</h2><p>O shell está pronto, mas a lista de servidores não respondeu.</p><button type="button" className="secondary-button" onClick={() => refreshServers().catch(() => {})}>Tentar novamente</button></div> : showServerEmpty ? <div className="server-welcome server-state-message"><Icon name="server" size={30} /><h2>Crie seu primeiro servidor</h2><p>Um espaço persistente para conversar com as pessoas que importam.</p><button type="button" className="primary-button" onClick={handleCreateServer}>Criar servidor</button></div> : messages.length ? messages.map((message) => <article className="server-message" key={message.id}><button type="button" className="server-message-avatar" onClick={() => setProfileUser(message.sender)} aria-label={`Ver perfil de ${message.sender.displayName || message.sender.username}`}><UserAvatar user={message.sender} size={34} /></button><div><div className="server-message-meta"><strong>{message.sender.displayName || message.sender.username}</strong><small>{new Date(message.createdAt).toLocaleString("pt-BR")}</small><button type="button" className="server-reply-button" onClick={() => setReplyingTo(message)} title="Responder" aria-label="Responder"><Icon name="reply" size={13} /></button></div>{message.replyToMessageId && <small className="server-reply-ref">Respondendo a uma mensagem</small>}{message.deletedAt ? <p className="server-message-deleted">Mensagem removida.</p> : <p>{message.content}</p>}{!message.deletedAt && <div className="server-message-reactions">{(message.reactions || []).map((reaction) => <button type="button" key={reaction.emoji} className={reaction.reacted ? "is-active" : ""} onClick={() => toggleReaction(message.id, reaction.emoji)}>{reaction.emoji} <small>{reaction.count}</small></button>)}<button type="button" onClick={() => toggleReaction(message.id, "👍")} title="Adicionar reação" aria-label="Adicionar reação">+</button></div>}</div></article>) : <div className="server-welcome"><Icon name="hash" size={30} /><h2>Comece em #{activeChannel?.name || "geral"}</h2><p>Este é o início do histórico persistente deste canal.</p></div>}</div>
       <div className="server-voice-audio-sinks" aria-hidden="true">{serverVoice.participants.filter((participant) => !participant.isLocal).map((participant) => <AudioParticipant key={participant.socketId} peerSocketId={participant.socketId} stream={participant.stream || serverVoice.remoteStreams[participant.socketId]} volume={100} isDeafened={false} />)}</div>
      {activeChannel?.type === "text" && <form className="server-composer" onSubmit={sendMessage}>{replyingTo && <div className="server-replying"><span>Respondendo a {replyingTo.sender.displayName || replyingTo.sender.username}</span><button type="button" className="icon-button" onClick={() => setReplyingTo(null)} aria-label="Cancelar resposta"><Icon name="close" size={13} /></button></div>}<button type="button" className="icon-button" title="Anexos indisponíveis nesta primeira camada" aria-label="Anexos indisponíveis"><Icon name="plus" size={18} /></button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Conversar em #${activeChannel.name}`} maxLength={4000} /><button type="submit" className="icon-button is-send" title="Enviar mensagem" aria-label="Enviar mensagem"><Icon name="send" size={16} /></button></form>}
    </section>
    <aside className="participants-panel server-members-panel"><div className="server-members-heading"><span>MEMBROS</span><strong>{server?.memberCount || 0}</strong></div><div className="server-members-list">{showServerLoading ? <ServerMembersLoadingState /> : members.map((member) => <button type="button" className="server-member-row" key={member.id} onClick={() => setProfileUser(member)}><UserAvatar user={member} size={28} /><span><strong>{member.displayName || member.username}</strong><small>{member.role === "owner" ? "Proprietário" : member.role === "admin" ? "Administrador" : "Membro"}</small><UserBadges user={member} badges={member.badges} compact /></span></button>)}{!showServerLoading && !members.length && <div className="server-members-note"><Icon name="account" size={18} /><p>Nenhum membro disponível.</p></div>}</div></aside>
    {profileUser && <SocialUserProfileModal userId={profileUser.id} initialUser={{ ...profileUser, status: "online" }} onClose={() => setProfileUser(null)} />}
    {error && null}
    {createOpen && <div className="modal-backdrop server-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setCreateOpen(false); }}><section className="server-create-modal" role="dialog" aria-modal="true" aria-labelledby="server-create-title"><header><div><span className="section-label">NOVO ESPAÇO</span><h2 id="server-create-title">Criar servidor</h2></div><button type="button" className="icon-button" onClick={() => setCreateOpen(false)} disabled={creating} aria-label="Fechar"><Icon name="close" size={16} /></button></header><p>Crie um espaço persistente para reunir suas conversas.</p><form id="server-create-form" onSubmit={submitCreateServer}><label className="field-label" htmlFor="server-create-name">Nome do servidor</label><input id="server-create-name" className="text-input" value={createName} onChange={(event) => { setCreateName(event.target.value); if (createError) setCreateError(""); }} placeholder="Ex.: Estudos" minLength={2} maxLength={60} autoFocus aria-invalid={Boolean(createError)} />{createError && <small className="field-error">{createError}</small>}<div className="server-create-note"><Icon name="info" size={15} /><span>A imagem do servidor poderá ser adicionada quando estiver persistida na conta.</span></div></form><footer><button type="button" className="secondary-button" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</button><button type="submit" form="server-create-form" className="primary-button" disabled={creating || createName.trim().length < 2}>{creating ? "Criando..." : "Criar servidor"}</button></footer></section></div>}
  </main>;
}

function updateReactionList(reactions = [], emoji, active) {
  const current = reactions.find((reaction) => reaction.emoji === emoji);
  if (active) return current ? reactions.map((reaction) => reaction.emoji === emoji ? { ...reaction, count: reaction.count + 1, reacted: true } : reaction) : [...reactions, { emoji, count: 1, reacted: true }];
  if (!current || current.count <= 1) return reactions.filter((reaction) => reaction.emoji !== emoji);
  return reactions.map((reaction) => reaction.emoji === emoji ? { ...reaction, count: reaction.count - 1, reacted: false } : reaction);
}

function ChannelGroup({ title, channels, activeChannelId, onSelect, voiceParticipants = [] }) {
  return <section className="server-channel-group"><div className="server-channel-label"><span>{title}</span><Icon name="chevron" size={13} /></div>{channels.map((channel) => <div key={channel.id} className="server-channel-block"><button type="button" className={`server-channel-row ${channel.id === activeChannelId ? "is-active" : ""}`} onClick={() => onSelect(channel.id)}><Icon name={channel.type === "voice" ? "voice" : "hash"} size={15} /><span>{channel.name}</span>{channel.type === "voice" && <small>{voiceParticipants.length || ""}</small>}</button>{channel.type === "voice" && channel.id === activeChannelId && voiceParticipants.map((participant) => <div className="server-voice-member" key={participant.socketId}><UserAvatar user={participant} size={22} /><span>{participant.displayName || participant.username}</span><span className="server-voice-member-icons">{participant.micEnabled === false && <Icon name="micOff" size={12} />}{participant.cameraEnabled && <Icon name="camera" size={12} />}{participant.isScreenSharing && <Icon name="screenShare" size={12} />}</span></div>)}</div>)}</section>;
}

function ServerLoadingState() {
  return <div className="server-state-message server-loading-state"><span className="loading-sheen" /><h2>Carregando servidor...</h2><p>Buscando canais, mensagens e participantes.</p></div>;
}

function ServerMembersLoadingState() {
  return <div className="server-members-loading"><span /><span /><span /></div>;
}
