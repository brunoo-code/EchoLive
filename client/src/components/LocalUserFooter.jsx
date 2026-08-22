/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Presentational structure directly derived from Fluxer UserArea.tsx:
 * user-area -> user-area-inner-wrapper -> user-info + controls. EchoLive handlers
 * and identity data remain the source of truth.
 */
import UserStatusBadge from "./UserStatusBadge.jsx";
import UserAvatar from "./UserAvatar.jsx";
import Icon from "./Icon.jsx";
import { presenceLabel } from "../utils/presence.js";

export default function LocalUserFooter({
  nickname,
  avatarUrl = "",
  avatarVariant = 0,
  isGuest = false,
  status = "online",
  customStatus = "",
  isSpeaking = false,
  isInVoice = false,
  micEnabled = true,
  isDeafened = false,
  onProfileClick,
  onToggleMicrophone,
  onToggleDeafen,
  onOpenUserSettings,
  className = ""
}) {
  const micAvailable = typeof onToggleMicrophone === "function";
  const deafenAvailable = isInVoice && typeof onToggleDeafen === "function";
  const label = isGuest ? "Visitante" : customStatus || presenceLabel(status);
  const user = { nickname, avatarUrl, avatarVariant, isGuest };

  const handleProfileKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onProfileClick?.(event);
    }
  };

  return <section className={`fluxer-user-area-inner-wrapper ${className}`.trim()} data-flx="app.user-area">
    <div className="fluxer-user-area-container">
      <div className={`fluxer-user-info ${isSpeaking ? "is-speaking" : ""}`} role="button" tabIndex={0} onClick={onProfileClick} onKeyDown={handleProfileKeyDown} aria-label="Abrir menu do perfil">
        <span className="fluxer-user-avatar">
          <UserAvatar user={user} size={30} />
          <UserStatusBadge status={status} size="md" />
        </span>
        <span className="fluxer-user-info-text">
          <strong className="fluxer-user-name" title={nickname}>{nickname}</strong>
          <span className="fluxer-user-status" title={label}>
            <span className="fluxer-user-status-roll">
              <span className="fluxer-user-status-default">{label}</span>
              <span className="fluxer-user-status-hovered">{isGuest ? "Visitante" : `@${nickname}`}</span>
            </span>
          </span>
        </span>
      </div>
      <div className="fluxer-user-controls" aria-label="Controles do usuario">
        <button type="button" className={`fluxer-user-control ${micEnabled ? "is-active" : "is-muted"}`} onClick={onToggleMicrophone} disabled={!micAvailable} data-tooltip={micEnabled ? "Silenciar microfone" : "Ativar microfone"} aria-label={micEnabled ? "Silenciar microfone" : "Ativar microfone"} aria-pressed={micEnabled}>
          <Icon name={micEnabled ? "mic" : "micOff"} size={16} />
        </button>
        <button type="button" className={`fluxer-user-control ${isDeafened ? "is-muted is-deafened" : "is-active"} ${!deafenAvailable ? "is-unavailable" : ""}`} onClick={onToggleDeafen} disabled={!deafenAvailable} data-tooltip={isDeafened ? "Ativar audio" : "Silenciar audio"} aria-label={isDeafened ? "Ativar audio" : "Silenciar audio"} aria-pressed={isDeafened}>
          <Icon name="headphones" size={16} />
        </button>
        <button type="button" className="fluxer-user-control" onClick={onOpenUserSettings} disabled={typeof onOpenUserSettings !== "function"} data-tooltip="Configuracoes" aria-label="Abrir configuracoes">
          <Icon name="settings" size={16} />
        </button>
      </div>
    </div>
  </section>;
}
