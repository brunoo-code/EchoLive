import Icon from "./Icon.jsx";
import BrandMark from "./BrandMark.jsx";
import UserAvatar from "./UserAvatar.jsx";
import { useMemo, useState } from "react";

function Avatar({ user, size = 34 }) {
  return <UserAvatar user={user} size={size} className="social-avatar" />;
}

function conversationPreview(conversation) {
  if (conversation.user?.isOfficial) return "Mensagem oficial do EchoLive";
  if (conversation.lastMessage?.content) return conversation.lastMessage.content;
  if (conversation.lastMessage?.attachment?.type === "image") return "Imagem";
  if (conversation.lastMessage?.attachment?.type === "video") return "Video";
  if (conversation.lastMessage?.attachment) return "Arquivo";
  return `@${conversation.user.username}`;
}

export default function SocialSidebar({ activeTab, onTabChange, conversations, onlineUserIds, user, onHome, onOpenConversation, onOpenProfile, onHideConversation, activeConversationId }) {
  const [conversationQuery, setConversationQuery] = useState("");
  const normalizedQuery = conversationQuery.trim().toLowerCase().replace(/^@/, "");
  const visibleConversations = useMemo(() => conversations.filter((conversation) => {
    if (!normalizedQuery) return true;
    const name = conversation.user.displayName || "";
    return `${name} ${conversation.user.username}`.toLowerCase().includes(normalizedQuery);
  }).sort((left, right) => Number(Boolean(right.user?.isOfficial)) - Number(Boolean(left.user?.isOfficial))), [conversations, normalizedQuery]);

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
        {visibleConversations.map((conversation) => <div className={`social-conversation-row ${conversation.user?.isOfficial ? "is-official" : ""} ${conversation.unreadCount > 0 ? "has-unread" : ""} ${activeConversationId === conversation.id ? "is-active" : ""}`} key={conversation.id}><button type="button" className="social-conversation-main" onClick={() => onOpenConversation(conversation.id)}><span className="social-conversation-avatar" onClick={(event) => { event.stopPropagation(); onOpenProfile?.(conversation.user, event.currentTarget.getBoundingClientRect()); }}><Avatar user={conversation.user} size={32} /><i className={conversation.user?.isOfficial || onlineUserIds.has(conversation.user.id) ? "is-online" : ""} /></span><span className="social-conversation-copy"><strong onClick={(event) => { event.stopPropagation(); onOpenProfile?.(conversation.user, event.currentTarget.getBoundingClientRect()); }}>{conversation.user.displayName || conversation.user.username}{conversation.user?.isOfficial && <em className="official-badge">OFICIAL</em>}</strong><small>{conversationPreview(conversation)}</small></span>{conversation.unreadCount > 0 && <b className="social-unread-badge" aria-label={`${conversation.unreadCount} mensagens nao lidas`}>{conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}</b>}</button>{!conversation.user?.isOfficial && <button type="button" className="social-conversation-close icon-button" title="Fechar conversa" aria-label="Fechar conversa" onClick={() => onHideConversation?.(conversation.id)}><Icon name="close" size={14} /></button>}</div>)}
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
