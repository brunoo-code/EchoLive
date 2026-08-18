import UserStatusBadge from "./UserStatusBadge.jsx";
import Icon from "./Icon.jsx";

export default function ProfilePopover({ accountUser, profile, nickname, avatarUrl, onStatusChange, onEditProfile, onOpenSettings, onLogout, onClose }) {
  const displayName = accountUser?.displayName || profile.displayName || nickname || "Usuario";
  const accountNickname = accountUser?.username || nickname || "nickname";
  const currentStatus = profile.status === "dnd" ? "dnd" : "online";

  return <section className="profile-popover" role="dialog" aria-label="Menu do perfil">
    <div className="profile-popover-header">
      <div className="profile-popover-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}<UserStatusBadge status={currentStatus} size="lg" /></div>
      <div className="profile-popover-identity"><strong title={displayName}>{displayName}</strong><span>@{accountNickname}</span><small title={profile.customStatus || ""}>{profile.customStatus || (currentStatus === "dnd" ? "Nao perturbe" : "Online")}</small></div>
    </div>
    <div className="profile-status-options" aria-label="Status do perfil">
      <button type="button" className={currentStatus === "online" ? "is-selected" : ""} onClick={() => onStatusChange("online")}><UserStatusBadge status="online" size="sm" /><span>Online</span>{currentStatus === "online" && <Icon name="check" size={14} />}</button>
      <button type="button" className={currentStatus === "dnd" ? "is-selected" : ""} onClick={() => onStatusChange("dnd")}><UserStatusBadge status="dnd" size="sm" /><span>Nao perturbe</span>{currentStatus === "dnd" && <Icon name="check" size={14} />}</button>
    </div>
    <div className="profile-popover-actions"><button type="button" onClick={onEditProfile}><Icon name="edit" size={15} /><span>Editar perfil</span></button><button type="button" onClick={onOpenSettings}><Icon name="settings" size={15} /><span>Configuracoes</span></button>{accountUser && <button type="button" onClick={onLogout}><Icon name="leave" size={15} /><span>Sair da conta</span></button>}</div>
  </section>;
}
