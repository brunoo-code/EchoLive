import { useState } from "react";
import UserStatusBadge from "./UserStatusBadge.jsx";
/* SPDX-License-Identifier: AGPL-3.0-or-later. Profile surface hierarchy directly derived from Fluxer user popouts. */
import Icon from "./Icon.jsx";
import BrandMark from "./BrandMark.jsx";
import UserBadges from "./UserBadges.jsx";
import PresenceMenu from "./PresenceMenu.jsx";
import { normalizePresence } from "../utils/presence.js";

export default function ProfilePopover({ accountUser, profile, nickname, avatarUrl, isGuest = false, guestAvatarVariant = 0, isInVoice = false, voiceChannelName = "Geral", connectionQuality = "", onStatusChange, onEditProfile, onOpenSettings, onLogout, onCreateAccount, onClose }) {
  const [statusError, setStatusError] = useState("");
  const sourceStatus = accountUser?.status || profile?.status;
  const currentStatus = normalizePresence(sourceStatus);

  async function selectStatus(nextStatus) {
    setStatusError("");
    try {
      await onStatusChange?.(nextStatus);
    } catch (error) {
      setStatusError(error.message || "Nao foi possivel alterar o status.");
    }
  }

  if (isGuest) {
    return <section className="profile-popover guest-profile-popover fluxer-profile-popover" data-flx="app.user-profile-popout.guest" role="dialog" aria-label="Perfil temporario">
      <div className="profile-popover-banner" aria-hidden="true" />
      <div className="profile-popover-body profile-card-layout">
        <div className="profile-avatar-layer">
          <div className="profile-popover-avatar guest-popover-avatar"><BrandMark size={34} variant={guestAvatarVariant} /></div>
        </div>
        <div className="profile-popover-header">
          <div className="profile-popover-identity"><strong>{nickname || "User temporario"}</strong><span>Perfil de sala rapida</span><small>Visitante</small></div>
        </div>
        <div className="profile-public-info guest-profile-copy"><strong>Quer deixar esse perfil com a sua cara?</strong><p>Crie uma conta para escolher seu nome, sua foto e manter sua identidade no EchoLive.</p></div>
        <div className="profile-popover-actions guest-profile-actions"><button type="button" className="primary-button" onClick={onCreateAccount}><Icon name="account" size={15} /><span>Criar conta</span></button><button type="button" className="text-button" onClick={onClose}>Agora nao</button></div>
      </div>
    </section>;
  }

  const displayName = accountUser?.displayName || profile?.displayName || nickname || "Usuario";
  const accountNickname = accountUser?.username || nickname || "nickname";
  const customStatus = accountUser?.customStatus || profile?.customStatus || "";
  const pronouns = accountUser?.pronouns || profile?.pronouns || "";
  const aboutMe = accountUser?.aboutMe || profile?.aboutMe || "";
  return <section className="profile-popover fluxer-profile-popover" data-flx="app.user-profile-popout" style={{ "--profile-accent": accountUser?.accentColor || profile?.accentColor || "#22D3EE" }} role="dialog" aria-label="Menu do perfil">
    <div className="profile-popover-banner" aria-hidden="true" />
    <div className="profile-popover-body profile-card-layout">
      <div className="profile-avatar-layer">
        <div className="profile-popover-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}<UserStatusBadge status={currentStatus} size="lg" /></div>
      </div>
      <div className="profile-popover-header">
        <div className="profile-popover-identity"><strong title={displayName}>{displayName}</strong><div className="profile-popover-username"><span>@{accountNickname}</span><UserBadges user={accountUser} badges={accountUser?.badges} /></div>{pronouns && <small>{pronouns}</small>}{customStatus && <small title={customStatus}>{customStatus}</small>}</div>
      </div>
      {aboutMe && <div className="profile-public-info profile-popover-about"><strong>Sobre mim</strong><p>{aboutMe}</p></div>}
      {isInVoice && <div className="profile-popover-voice"><span className="profile-popover-voice-icon"><Icon name="voice" size={15} /></span><span><strong>Em voz</strong><small>{voiceChannelName}{connectionQuality ? ` · ${connectionQuality}` : ""}</small></span><i className="online-dot" /></div>}
        <div className="profile-popover-action-group" data-flx="app.user-profile-popout.action-group">
        <PresenceMenu value={currentStatus} onChange={selectStatus} placement="side" className="profile-status-menu" label="Status do perfil" />
        {statusError && <small className="profile-status-error" role="alert">{statusError}</small>}
        <div className="profile-popover-actions"><button type="button" onClick={onOpenSettings}><Icon name="settings" size={15} /><span>Configuracoes</span></button>{accountUser && <button type="button" className="profile-logout-button" onClick={onLogout}><Icon name="leave" size={15} /><span>Sair da conta</span></button>}</div>
      </div>
      <div className="profile-popover-actions profile-popover-edit-actions"><button type="button" className="profile-edit-primary" onClick={onEditProfile}><Icon name="edit" size={15} /><span>Editar perfil</span></button></div>
    </div>
  </section>;
}
