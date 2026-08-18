import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";

function Avatar({ user, size = 34 }) {
  if (user?.avatarUrl) return <img className="social-avatar" width={size} height={size} src={user.avatarUrl} alt="" />;
  return <span className="social-avatar social-avatar-eko" style={{ width: size, height: size }}><BrandMark size={size} variant={user?.avatarVariant} /></span>;
}

export default function SocialSidebar({ activeTab, onTabChange, conversations, onlineUserIds, user, onHome, onOpenConversation, activeConversationId, pendingCount = 0 }) {
  const tabs = [
    ["friends", "Amigos", "account"],
    ["online", "Online", "pulse"],
    ["all", "Todos", "user"],
    ["pending", "Pendentes", "info"]
  ];
  return <aside className="social-sidebar">
    <div className="social-sidebar-brand">
      <button type="button" className="social-brand-button" onClick={onHome} title="Voltar para a Home"><BrandMark size={28} /><strong>EchoLive</strong></button>
      <span className="social-brand-caption">Pessoas e conversas</span>
    </div>
    <nav className="social-nav" aria-label="Navegacao social">
      {tabs.map(([id, label, icon]) => <button type="button" key={id} className={activeTab === id ? "is-active" : ""} onClick={() => onTabChange(id)}><Icon name={icon} size={16} /><span>{label}</span>{id === "pending" && pendingCount > 0 && <b className="social-nav-badge">{pendingCount > 9 ? "9+" : pendingCount}</b>}</button>)}
      <button type="button" className={activeTab === "add" ? "is-active" : ""} onClick={() => onTabChange("add")}><Icon name="plus" size={16} /><span>Adicionar amigo</span></button>
    </nav>
    <div className="social-sidebar-section">
      <div className="social-sidebar-section-title"><span>Mensagens diretas</span><button type="button" title="Nova conversa" aria-label="Nova conversa" onClick={() => onTabChange("friends")}><Icon name="plus" size={14} /></button></div>
      <div className="social-conversation-list">
        {conversations.map((conversation) => <button type="button" className={`social-conversation-row ${activeConversationId === conversation.id ? "is-active" : ""}`} key={conversation.id} onClick={() => onOpenConversation(conversation.id)}><span className="social-conversation-avatar"><Avatar user={conversation.user} size={32} /><i className={onlineUserIds.has(conversation.user.id) ? "is-online" : ""} /></span><span className="social-conversation-copy"><strong>{conversation.user.displayName || conversation.user.username}</strong><small>{conversation.lastMessage?.content || `@${conversation.user.username}`}</small></span>{conversation.unreadCount > 0 && <b className="social-unread-badge">{conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}</b>}</button>)}
        {!conversations.length && <p className="social-sidebar-empty">Suas conversas aparecerao aqui.</p>}
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
