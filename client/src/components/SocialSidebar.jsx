/* SPDX-License-Identifier: AGPL-3.0-or-later. Sidebar presentation hierarchy directly derived from Fluxer layout surfaces. */
import Icon from "./Icon.jsx";
import UserAvatar from "./UserAvatar.jsx";
import LocalUserFooter from "./LocalUserFooter.jsx";
import { useEffect, useMemo, useState } from "react";
import { Badge, IconButton, SearchInput, StatusDot } from "./FluxerPrimitives.jsx";

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

export default function SocialSidebar({ activeTab, onTabChange, conversations, onlineUserIds, user, onOpenConversation, onOpenProfile, onOpenSettings, onHideConversation, activeConversationId, socialStatus }) {
  const [conversationQuery, setConversationQuery] = useState("");
  const normalizedQuery = conversationQuery.trim().toLowerCase().replace(/^@/, "");
  const visibleConversations = useMemo(() => conversations.filter((conversation) => {
    if (!normalizedQuery) return true;
    const name = conversation.user.displayName || "";
    return `${name} ${conversation.user.username}`.toLowerCase().includes(normalizedQuery);
  }).sort((left, right) => Number(Boolean(right.user?.isOfficial)) - Number(Boolean(left.user?.isOfficial))), [conversations, normalizedQuery]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug("[OFFICIAL:client]", {
        surface: "sidebar",
        conversationCount: conversations.length,
        officialFound: conversations.some((conversation) => conversation.user?.isOfficial === true)
      });
    }
  }, [conversations]);

  return <aside className="fluxer-social-sidebar" data-flx="app.layout.social-sidebar">
    <div className="fluxer-social-sidebar-layout">
      <header className="fluxer-social-sidebar-header"><SearchInput value={conversationQuery} onChange={setConversationQuery} placeholder="Encontre ou comece uma conversa" label="Buscar conversas" /></header>
      <nav className="fluxer-social-nav" aria-label="Navegacao social">
        <button type="button" className={activeTab !== "add" ? "is-active" : ""} onClick={() => onTabChange("all")}><Icon name="account" size={16} /><span>Amigos</span></button>
      </nav>
      <div className="fluxer-social-sidebar-scroller">
        <div className="fluxer-section-heading"><span>Mensagens diretas</span><button type="button" title="Nova conversa" aria-label="Nova conversa" onClick={() => onTabChange("friends")}><Icon name="plus" size={14} /></button></div>
        <div className="fluxer-dm-list" data-flx="channel.direct-message.list">
          {visibleConversations.map((conversation) => <article data-flx="channel.direct-message.dm-list-item" className={`fluxer-dm-item ${conversation.user?.isOfficial ? "is-official" : ""} ${conversation.unreadCount > 0 ? "has-unread" : ""} ${activeConversationId === conversation.id ? "is-active" : ""}`} key={conversation.id}><button type="button" className="fluxer-dm-item-content" onClick={() => onOpenConversation(conversation.id)}><span className="fluxer-dm-avatar" onClick={(event) => { event.stopPropagation(); onOpenProfile?.(conversation.user, event.currentTarget.getBoundingClientRect()); }}><Avatar user={conversation.user} size={32} /><StatusDot status={conversation.user?.isOfficial || onlineUserIds.has(conversation.user.id) ? "online" : "offline"} /></span><span className="fluxer-dm-info"><span className="fluxer-dm-name-row"><strong onClick={(event) => { event.stopPropagation(); onOpenProfile?.(conversation.user, event.currentTarget.getBoundingClientRect()); }}>{conversation.user.displayName || conversation.user.username}</strong>{conversation.user?.isOfficial && <Badge tone="official">OFICIAL</Badge>}</span><small>{conversationPreview(conversation)}</small></span>{conversation.unreadCount > 0 && <Badge tone="unread" aria-label={`${conversation.unreadCount} mensagens nao lidas`}>{conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}</Badge>}</button>{!conversation.user?.isOfficial && <IconButton className="fluxer-dm-close" label="Fechar conversa" onClick={() => onHideConversation?.(conversation.id)}><Icon name="close" size={14} /></IconButton>}</article>)}
          {!visibleConversations.length && <p className="fluxer-social-empty">{normalizedQuery ? "Nenhuma conversa encontrada." : socialStatus === "loading" ? "Carregando conversas..." : socialStatus === "error" ? "Nao foi possivel carregar as conversas." : "Suas conversas aparecerao aqui."}</p>}
        </div>
      </div>
    </div>
    <LocalUserFooter nickname={user?.displayName || user?.username || "Conta"} avatarUrl={user?.avatarUrl || ""} avatarVariant={user?.avatarVariant || 0} status={user?.status || "online"} customStatus={user?.customStatus || ""} onProfileClick={(event) => onOpenProfile?.(user, event.currentTarget.getBoundingClientRect())} onOpenUserSettings={onOpenSettings} />
  </aside>;
}

export { Avatar };
