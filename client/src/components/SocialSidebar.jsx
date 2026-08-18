import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";
import { useMemo, useState } from "react";

function Avatar({ user, size = 34 }) {
  if (user?.avatarUrl) return <img className="social-avatar" width={size} height={size} src={user.avatarUrl} alt="" />;
  return <span className="social-avatar social-avatar-eko" style={{ width: size, height: size }}><BrandMark size={size} variant={user?.avatarVariant} /></span>;
}

export default function SocialSidebar({ activeTab, onTabChange, conversations, onlineUserIds, user, onHome, onOpenConversation, activeConversationId }) {
  const [conversationQuery, setConversationQuery] = useState("");
  const normalizedQuery = conversationQuery.trim().toLowerCase().replace(/^@/, "");
  const visibleConversations = useMemo(() => conversations.filter((conversation) => {
    if (!normalizedQuery) return true;
    const name = conversation.user.displayName || "";
    return `${name} ${conversation.user.username}`.toLowerCase().includes(normalizedQuery);
  }), [conversations, normalizedQuery]);

  return <aside className="social-sidebar">
    <div className="social-sidebar-brand">
      <button type="button" className="social-brand-button" onClick={onHome} title="Voltar para a Home"><BrandMark size={28} /><strong>EchoLive</strong></button>
      <span className="social-brand-caption">Pessoas e conversas</span>
    </div>
    <label className="social-sidebar-search"><Icon name="search" size={15} /><span className="sr-only">Buscar conversas</span><input value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} placeholder="Encontre ou comece uma conversa" /></label>
    <nav className="social-nav" aria-label="Navegacao social">
      <button type="button" className={activeTab !== "add" ? "is-active" : ""} onClick={() => onTabChange("friends")}><Icon name="account" size={16} /><span>Amigos</span></button>
    </nav>
    <div className="social-sidebar-section">
      <div className="social-sidebar-section-title"><span>Mensagens diretas</span><button type="button" title="Nova conversa" aria-label="Nova conversa" onClick={() => onTabChange("friends")}><Icon name="plus" size={14} /></button></div>
      <div className="social-conversation-list">
        {visibleConversations.map((conversation) => <button type="button" className={`social-conversation-row ${activeConversationId === conversation.id ? "is-active" : ""}`} key={conversation.id} onClick={() => onOpenConversation(conversation.id)}><span className="social-conversation-avatar"><Avatar user={conversation.user} size={32} /><i className={onlineUserIds.has(conversation.user.id) ? "is-online" : ""} /></span><span className="social-conversation-copy"><strong>{conversation.user.displayName || conversation.user.username}</strong><small>{conversation.lastMessage?.content || `@${conversation.user.username}`}</small></span>{conversation.unreadCount > 0 && <b className="social-unread-badge">{conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}</b>}</button>)}
        {!visibleConversations.length && <p className="social-sidebar-empty">{normalizedQuery ? "Nenhuma conversa encontrada." : "Suas conversas aparecerao aqui."}</p>}
      </div>
    </div>
    <div className="social-sidebar-footer">
      <Avatar user={user} size={36} />
      <span><strong>{user?.displayName || user?.username}</strong><small>@{user?.username}</small></span>
      <button type="button" title="Voltar para salas" aria-label="Voltar para salas" onClick={onHome}><Icon name="home" size={17} /></button>
    </div>
  </aside>;
}

export { Avatar };
