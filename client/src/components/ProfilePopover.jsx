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
      setStatusError(error.message || "Não foi possível alterar o status.");
    }
  }

  if (isGuest) {
    return <section className="fluxer-profile-popover fluxer-profile-popover--guest" data-flx="app.user-profile-popout.guest" role="dialog" aria-label="Perfil temporario">
      <div className="fluxer-profile-banner" aria-hidden="true" />
      <div className="fluxer-profile-body">
        <div className="fluxer-profile-avatar-layer">
          <div className="fluxer-profile-avatar fluxer-profile-guest-avatar"><BrandMark size={34} variant={guestAvatarVariant} /></div>
        </div>
        <div className="fluxer-profile-header">
          <div className="fluxer-profile-identity"><strong>{nickname || "User temporario"}</strong><span>Perfil de sala rapida</span><small>Visitante</small></div>
        </div>
        <div className="fluxer-profile-about fluxer-profile-guest-copy"><strong>Quer deixar esse perfil com a sua cara?</strong><p>Crie uma conta para escolher seu nome, sua foto e manter sua identidade no EchoLive.</p></div>
        <div className="fluxer-profile-actions fluxer-profile-guest-actions"><button type="button" className="fluxer-profile-action-primary" onClick={onCreateAccount}><Icon name="account" size={15} /><span>Criar conta</span></button><button type="button" className="fluxer-profile-action-secondary" onClick={onClose}>Agora não</button></div>
      </div>
    </section>;
  }

  const displayName = accountUser?.displayName || profile?.displayName || nickname || "Usuário";
  const accountNickname = accountUser?.username || nickname || "nickname";
  const customStatus = accountUser?.customStatus || profile?.customStatus || "";
  const pronouns = accountUser?.pronouns || profile?.pronouns || "";
  const aboutMe = accountUser?.aboutMe || profile?.aboutMe || "";
  return <section className="fluxer-profile-popover" data-flx="app.user-profile-popout" style={{ "--profile-accent": accountUser?.accentColor || profile?.accentColor || "#22D3EE" }} role="dialog" aria-label="Menu do perfil">
    <div className="fluxer-profile-banner" aria-hidden="true" />
    <div className="fluxer-profile-body">
      <div className="fluxer-profile-avatar-layer">
        <div className="fluxer-profile-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}<UserStatusBadge status={currentStatus} size="lg" /></div>
      </div>
      <div className="fluxer-profile-header">
        <div className="fluxer-profile-identity"><strong title={displayName}>{displayName}</strong><div className="fluxer-profile-username"><span>@{accountNickname}</span><UserBadges user={accountUser} badges={accountUser?.badges} /></div>{pronouns && <small>{pronouns}</small>}{customStatus && <small title={customStatus}>{customStatus}</small>}</div>
      </div>
      {aboutMe && <div className="fluxer-profile-about"><strong>Sobre mim</strong><p>{aboutMe}</p></div>}
      {isInVoice && <div className="fluxer-profile-voice"><span className="fluxer-profile-voice-icon"><Icon name="voice" size={15} /></span><span><strong>Em voz</strong><small>{voiceChannelName}{connectionQuality ? ` · ${connectionQuality}` : ""}</small></span><i className="fluxer-profile-online-dot" /></div>}
        <div className="fluxer-profile-action-group" data-flx="app.user-profile-popout.action-group">
        <PresenceMenu value={currentStatus} onChange={selectStatus} placement="side" className="fluxer-profile-status-menu" label="Status do perfil" />
        {statusError && <small className="fluxer-profile-status-error" role="alert">{statusError}</small>}
        <div className="fluxer-profile-actions"><button type="button" onClick={onOpenSettings}><Icon name="settings" size={15} /><span>Configurações</span></button>{accountUser && <button type="button" className="fluxer-profile-logout" onClick={onLogout}><Icon name="leave" size={15} /><span>Sair da conta</span></button>}</div>
      </div>
      <div className="fluxer-profile-actions fluxer-profile-edit-actions"><button type="button" className="fluxer-profile-action-primary" onClick={onEditProfile}><Icon name="edit" size={15} /><span>Editar perfil</span></button></div>
    </div>
  </section>;
}
