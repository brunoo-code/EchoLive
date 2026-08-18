import UserStatusBadge from "./UserStatusBadge.jsx";

export default function ProfilePopover({ profile, nickname, avatarUrl, onStatusChange, onEditProfile, onOpenSettings, onClose }) {
  const displayName = profile.displayName || nickname || "Usuario";
  const currentStatus = profile.status === "dnd" ? "dnd" : "online";

  return <section className="profile-popover" role="dialog" aria-label="Menu do perfil">
    <div className="profile-popover-header">
      <div className="profile-popover-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}<UserStatusBadge status={currentStatus} size="lg" /></div>
      <div className="profile-popover-identity"><strong title={displayName}>{displayName}</strong><span>@{nickname || "nickname"}</span><small title={profile.customStatus || ""}>{profile.customStatus || (currentStatus === "dnd" ? "Nao perturbe" : "Online")}</small></div>
    </div>
    <div className="profile-status-options" aria-label="Status do perfil">
      <button type="button" className={currentStatus === "online" ? "is-selected" : ""} onClick={() => onStatusChange("online")}><UserStatusBadge status="online" size="sm" />Online</button>
      <button type="button" className={currentStatus === "dnd" ? "is-selected" : ""} onClick={() => onStatusChange("dnd")}><UserStatusBadge status="dnd" size="sm" />Nao perturbe</button>
    </div>
    <div className="profile-popover-actions"><button type="button" onClick={onEditProfile}>Editar perfil</button><button type="button" onClick={onOpenSettings}>Configuracoes</button></div>
  </section>;
}
