import { useState } from "react";
import UserStatusBadge from "./UserStatusBadge.jsx";
import Icon from "./Icon.jsx";
import BrandMark from "./BrandMark.jsx";
import UserBadges from "./UserBadges.jsx";

export default function ProfilePopover({ accountUser, profile, nickname, avatarUrl, isGuest = false, guestAvatarVariant = 0, isInVoice = false, voiceChannelName = "Geral", connectionQuality = "", onStatusChange, onEditProfile, onOpenSettings, onLogout, onCreateAccount, onClose }) {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  if (isGuest) {
    return <section className="profile-popover guest-profile-popover" role="dialog" aria-label="Perfil temporario">
      <div className="profile-popover-banner" aria-hidden="true" />
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
  const currentStatus = ["online", "dnd", "invisible"].includes(accountUser?.status || profile.status) ? accountUser?.status || profile.status : "online";
  const customStatus = accountUser?.customStatus || profile.customStatus || "";
  const pronouns = accountUser?.pronouns || profile.pronouns || "";
  const aboutMe = accountUser?.aboutMe || profile.aboutMe || "";
  const statusLabel = currentStatus === "dnd" ? "Nao perturbe" : currentStatus === "invisible" ? "Invisivel" : "Online";

  return <section className="profile-popover" style={{ "--profile-accent": accountUser?.accentColor || profile.accentColor || "#22D3EE" }} role="dialog" aria-label="Menu do perfil">
    <div className="profile-popover-banner" aria-hidden="true" />
    <div className="profile-popover-header">
      <div className="profile-popover-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}<UserStatusBadge status={currentStatus} size="lg" /></div>
      <div className="profile-popover-identity"><strong title={displayName}>{displayName}</strong><div className="profile-popover-username"><span>@{accountNickname}</span><UserBadges user={accountUser} badges={accountUser?.badges} /></div>{pronouns && <small>{pronouns}</small>}<small title={customStatus}>{customStatus || statusLabel}</small></div>
    </div>
    {aboutMe && <div className="profile-popover-about"><strong>Sobre mim</strong><p>{aboutMe}</p></div>}
    {isInVoice && <div className="profile-popover-voice"><span className="profile-popover-voice-icon"><Icon name="voice" size={15} /></span><span><strong>Em voz</strong><small>{voiceChannelName}{connectionQuality ? ` · ${connectionQuality}` : ""}</small></span><i className="online-dot" /></div>}
    <div className="profile-status-menu">
      <button type="button" className="profile-status-trigger" onClick={() => setStatusMenuOpen((value) => !value)} aria-expanded={statusMenuOpen} aria-haspopup="menu"><UserStatusBadge status={currentStatus} size="sm" /><span>{statusLabel}</span><Icon name="chevron" size={14} /></button>
      {statusMenuOpen && <div className="profile-status-options" role="menu" aria-label="Status do perfil">
        <button type="button" role="menuitemradio" aria-checked={currentStatus === "online"} className={currentStatus === "online" ? "is-selected" : ""} onClick={() => { onStatusChange("online"); setStatusMenuOpen(false); }}><UserStatusBadge status="online" size="sm" /><span>Online</span>{currentStatus === "online" && <Icon name="check" size={14} />}</button>
        <button type="button" role="menuitemradio" aria-checked={currentStatus === "dnd"} className={currentStatus === "dnd" ? "is-selected" : ""} onClick={() => { onStatusChange("dnd"); setStatusMenuOpen(false); }}><UserStatusBadge status="dnd" size="sm" /><span>Nao perturbe</span>{currentStatus === "dnd" && <Icon name="check" size={14} />}</button>
        <button type="button" role="menuitemradio" aria-checked={currentStatus === "invisible"} className={currentStatus === "invisible" ? "is-selected" : ""} onClick={() => { onStatusChange("invisible"); setStatusMenuOpen(false); }}><UserStatusBadge status="invisible" size="sm" /><span>Invisivel</span>{currentStatus === "invisible" && <Icon name="check" size={14} />}</button>
      </div>}
    </div>
    <div className="profile-popover-actions"><button type="button" onClick={onEditProfile}><Icon name="edit" size={15} /><span>Editar perfil</span></button><button type="button" onClick={onOpenSettings}><Icon name="settings" size={15} /><span>Configuracoes</span></button>{accountUser && <button type="button" className="profile-logout-button" onClick={onLogout}><Icon name="leave" size={15} /><span>Sair da conta</span></button>}</div>
  </section>;
}
