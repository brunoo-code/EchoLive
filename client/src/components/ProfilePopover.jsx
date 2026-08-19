import UserStatusBadge from "./UserStatusBadge.jsx";
import Icon from "./Icon.jsx";
import BrandMark from "./BrandMark.jsx";
import UserBadges from "./UserBadges.jsx";

export default function ProfilePopover({ accountUser, profile, nickname, avatarUrl, isGuest = false, guestAvatarVariant = 0, onStatusChange, onEditProfile, onOpenSettings, onLogout, onCreateAccount, onClose }) {
  if (isGuest) {
    return <section className="profile-popover guest-profile-popover" role="dialog" aria-label="Perfil temporario">
      <div className="profile-popover-header">
        <div className="profile-popover-avatar guest-popover-avatar"><BrandMark size={34} variant={guestAvatarVariant} /></div>
        <div className="profile-popover-identity"><strong>{nickname || "User temporario"}</strong><span>Perfil de sala rapida</span><small>Visitante</small></div>
      </div>
      <div className="guest-profile-copy"><strong>Quer deixar esse perfil com a sua cara?</strong><p>Crie uma conta para escolher seu nome, sua foto e manter sua identidade no EchoLive.</p></div>
      <div className="profile-popover-actions guest-profile-actions"><button type="button" className="primary-button" onClick={onCreateAccount}><Icon name="account" size={15} /><span>Criar conta</span></button><button type="button" className="text-button" onClick={onClose}>Agora nao</button></div>
    </section>;
  }

  const displayName = accountUser?.displayName || profile.displayName || nickname || "Usuario";
  const accountNickname = accountUser?.username || nickname || "nickname";
  const currentStatus = profile.status === "dnd" ? "dnd" : "online";

  return <section className="profile-popover" role="dialog" aria-label="Menu do perfil">
    <div className="profile-popover-header">
      <div className="profile-popover-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}<UserStatusBadge status={currentStatus} size="lg" /></div>
      <div className="profile-popover-identity"><strong title={displayName}>{displayName}</strong><div className="profile-popover-username"><span>@{accountNickname}</span><UserBadges user={accountUser} badges={accountUser?.badges} /></div><small title={profile.customStatus || ""}>{profile.customStatus || (currentStatus === "dnd" ? "Nao perturbe" : "Online")}</small></div>
    </div>
    <div className="profile-status-options" aria-label="Status do perfil">
      <button type="button" className={currentStatus === "online" ? "is-selected" : ""} onClick={() => onStatusChange("online")}><UserStatusBadge status="online" size="sm" /><span>Online</span>{currentStatus === "online" && <Icon name="check" size={14} />}</button>
      <button type="button" className={currentStatus === "dnd" ? "is-selected" : ""} onClick={() => onStatusChange("dnd")}><UserStatusBadge status="dnd" size="sm" /><span>Nao perturbe</span>{currentStatus === "dnd" && <Icon name="check" size={14} />}</button>
    </div>
    <div className="profile-popover-actions"><button type="button" onClick={onEditProfile}><Icon name="edit" size={15} /><span>Editar perfil</span></button><button type="button" onClick={onOpenSettings}><Icon name="settings" size={15} /><span>Configuracoes</span></button>{accountUser && <button type="button" className="profile-logout-button" onClick={onLogout}><Icon name="leave" size={15} /><span>Sair da conta</span></button>}</div>
  </section>;
}
