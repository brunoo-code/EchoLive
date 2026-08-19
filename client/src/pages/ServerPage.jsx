import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import Icon from "../components/Icon.jsx";
import RoomRail from "../components/RoomRail.jsx";
import SocialUserProfileModal from "../components/SocialUserProfileModal.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import UserBadges from "../components/UserBadges.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useServers } from "../servers/ServerContext.jsx";
import { SERVER_URL } from "../utils/webrtc.js";

async function request(path, options = {}) {
  const response = await fetch(`${SERVER_URL}${path}`, { ...options, credentials: "include", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Nao foi possivel acessar o servidor.");
  return data;
}

export default function ServerPage({ serverId, onNavigateHome, onNavigateSocial, onNavigateServer }) {
  const { user, isAuthenticated } = useAuth();
  const { servers, createServer, refreshServers } = useServers();
  const [server, setServer] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState("");
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const socketRef = useRef(null);

  const activeChannel = useMemo(() => server?.channels?.find((channel) => channel.id === activeChannelId) || server?.channels?.find((channel) => channel.type === "text") || null, [activeChannelId, server]);
  const textChannels = server?.channels?.filter((channel) => channel.type === "text") || [];
  const voiceChannels = server?.channels?.filter((channel) => channel.type === "voice") || [];

  useEffect(() => {
    if (isAuthenticated) refreshServers().catch(() => {});
  }, [isAuthenticated, refreshServers]);

  useEffect(() => {
    if (!isAuthenticated || !serverId) {
      setServer(null);
      return;
    }
    let active = true;
    Promise.all([request(`/api/servers/${serverId}`), request(`/api/servers/${serverId}/members`)]).then(([serverData, memberData]) => { if (active) { setServer(serverData.server); setMembers(memberData.members || []); } }).catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [isAuthenticated, serverId]);

  useEffect(() => {
    if (!serverId || !activeChannel?.id) return undefined;
    let active = true;
    setActiveChannelId(activeChannel.id);
    request(`/api/servers/${serverId}/channels/${activeChannel.id}/messages`).then((data) => { if (active) setMessages(data.messages || []); }).catch((requestError) => { if (active) setError(requestError.message); });
    const socket = io(SERVER_URL, { withCredentials: true });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("server:subscribe", { serverId, channelId: activeChannel.id }));
    socket.on("server:message-created", (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]));
    socket.on("server:reaction-updated", ({ messageId, emoji, active: reactionActive }) => setMessages((current) => current.map((message) => message.id !== messageId ? message : { ...message, reactions: updateReactionList(message.reactions, emoji, reactionActive) })));
    return () => { active = false; socket.emit("server:unsubscribe", { serverId, channelId: activeChannel.id }); socket.disconnect(); socketRef.current = null; };
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

  async function handleCreateServer() {
    const name = window.prompt("Nome do servidor");
    if (!name) return;
    setCreating(true);
    try {
      const created = await createServer({ name });
      onNavigateServer?.(created.id);
    } catch (requestError) { setError(requestError.message); } finally { setCreating(false); }
  }

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

  if (!isAuthenticated) return <main className="page server-page server-page-gate"><section className="social-guest-gate"><Icon name="lock" size={24} /><h1>Servidores ficam com a sua conta.</h1><p>Entre ou crie uma conta para manter seus servidores, canais e mensagens por aqui.</p><button type="button" className="primary-button" onClick={onNavigateHome}>Voltar para a Home</button></section></main>;

  return <main className="page room-page server-page">
    <RoomRail roomCode="" roomName="" recentRooms={[]} onHome={onNavigateHome} onSocial={onNavigateSocial} onOpenSwitcher={handleCreateServer} servers={servers} activeServerId={serverId} onOpenServer={onNavigateServer} onCreateServer={handleCreateServer} />
    <aside className="app-sidebar server-sidebar">
      <header className="server-sidebar-header"><div><span className="section-label">SERVIDOR</span><strong>{server?.name || "Seus servidores"}</strong></div><button type="button" className="icon-button" onClick={handleCreateServer} title="Criar servidor" aria-label="Criar servidor" disabled={creating}><Icon name="plus" size={16} /></button></header>
      {server ? <div className="server-channel-list"><ChannelGroup title="Canais de texto" channels={textChannels} activeChannelId={activeChannel?.id} onSelect={setActiveChannelId} /><ChannelGroup title="Canais de voz" channels={voiceChannels} activeChannelId={activeChannel?.id} onSelect={(id) => setActiveChannelId(id)} /></div> : <div className="server-empty"><Icon name="server" size={24} /><strong>Crie seu primeiro servidor</strong><span>Um espaço persistente para suas conversas.</span><button type="button" className="primary-button" onClick={handleCreateServer}>Criar servidor</button></div>}
      <div className="server-sidebar-footer"><UserAvatar user={user} size={30} /><span><strong>{user.displayName || user.username}</strong><small>@{user.username}</small></span></div>
    </aside>
    <section className="central-stage server-main">
      <header className="server-main-header"><div><span className="channel-kind"><Icon name="hash" size={17} /></span><strong>{activeChannel?.name || "Selecione um canal"}</strong></div><span>{server ? `${server.memberCount} membro${server.memberCount === 1 ? "" : "s"}` : ""}</span></header>
      {error && <div className="server-error" role="alert">{error}<button type="button" className="icon-button" onClick={() => setError("")} aria-label="Fechar aviso"><Icon name="close" size={14} /></button></div>}
      <div className="server-message-list">{messages.length ? messages.map((message) => <article className="server-message" key={message.id}><button type="button" className="server-message-avatar" onClick={() => setProfileUser(message.sender)} aria-label={`Ver perfil de ${message.sender.displayName || message.sender.username}`}><UserAvatar user={message.sender} size={34} /></button><div><div className="server-message-meta"><strong>{message.sender.displayName || message.sender.username}</strong><small>{new Date(message.createdAt).toLocaleString("pt-BR")}</small><button type="button" className="server-reply-button" onClick={() => setReplyingTo(message)} title="Responder" aria-label="Responder"><Icon name="reply" size={13} /></button></div>{message.replyToMessageId && <small className="server-reply-ref">Respondendo a uma mensagem</small>}{message.deletedAt ? <p className="server-message-deleted">Mensagem removida.</p> : <p>{message.content}</p>}{!message.deletedAt && <div className="server-message-reactions">{(message.reactions || []).map((reaction) => <button type="button" key={reaction.emoji} className={reaction.reacted ? "is-active" : ""} onClick={() => toggleReaction(message.id, reaction.emoji)}>{reaction.emoji} <small>{reaction.count}</small></button>)}<button type="button" onClick={() => toggleReaction(message.id, "👍")} title="Adicionar reação" aria-label="Adicionar reação">+</button></div>}</div></article>) : <div className="server-welcome"><Icon name="hash" size={30} /><h2>Comece em #{activeChannel?.name || "geral"}</h2><p>Este é o início do histórico persistente deste canal.</p></div>}</div>
      {activeChannel?.type === "text" && <form className="server-composer" onSubmit={sendMessage}>{replyingTo && <div className="server-replying"><span>Respondendo a {replyingTo.sender.displayName || replyingTo.sender.username}</span><button type="button" className="icon-button" onClick={() => setReplyingTo(null)} aria-label="Cancelar resposta"><Icon name="close" size={13} /></button></div>}<button type="button" className="icon-button" title="Anexos indisponíveis nesta primeira camada" aria-label="Anexos indisponíveis"><Icon name="plus" size={18} /></button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Conversar em #${activeChannel.name}`} maxLength={4000} /><button type="submit" className="icon-button is-send" title="Enviar mensagem" aria-label="Enviar mensagem"><Icon name="send" size={16} /></button></form>}
    </section>
    <aside className="participants-panel server-members-panel"><div className="server-members-heading"><span>MEMBROS</span><strong>{server?.memberCount || 0}</strong></div><div className="server-members-list">{members.map((member) => <button type="button" className="server-member-row" key={member.id} onClick={() => setProfileUser(member)}><UserAvatar user={member} size={28} /><span><strong>{member.displayName || member.username}</strong><small>{member.role === "owner" ? "Proprietário" : member.role === "admin" ? "Administrador" : "Membro"}</small><UserBadges user={member} badges={member.badges} compact /></span></button>)}{!members.length && <div className="server-members-note"><Icon name="account" size={18} /><p>Nenhum membro disponível.</p></div>}</div></aside>
    {profileUser && <SocialUserProfileModal userId={profileUser.id} initialUser={{ ...profileUser, status: "online" }} onClose={() => setProfileUser(null)} />}
    {error && null}
  </main>;
}

function updateReactionList(reactions = [], emoji, active) {
  const current = reactions.find((reaction) => reaction.emoji === emoji);
  if (active) return current ? reactions.map((reaction) => reaction.emoji === emoji ? { ...reaction, count: reaction.count + 1, reacted: true } : reaction) : [...reactions, { emoji, count: 1, reacted: true }];
  if (!current || current.count <= 1) return reactions.filter((reaction) => reaction.emoji !== emoji);
  return reactions.map((reaction) => reaction.emoji === emoji ? { ...reaction, count: reaction.count - 1, reacted: false } : reaction);
}

function ChannelGroup({ title, channels, activeChannelId, onSelect }) {
  return <section className="server-channel-group"><div className="server-channel-label"><span>{title}</span><Icon name="chevron" size={13} /></div>{channels.map((channel) => <button type="button" className={`server-channel-row ${channel.id === activeChannelId ? "is-active" : ""}`} key={channel.id} onClick={() => onSelect(channel.id)}><Icon name={channel.type === "voice" ? "voice" : "hash"} size={15} /><span>{channel.name}</span></button>)}</section>;
}
