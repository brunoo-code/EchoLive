/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Presentational structure directly derived from Fluxer UserArea.tsx:
 * user-area -> user-area-inner -> user-info + controls. EchoLive handlers
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

  return <footer className={`local-user-footer sidebar-user-footer user-area ${className}`.trim()}>
    <div className="user-area-inner">
      <button type="button" className={`sidebar-user-summary local-user-identity user-area-user-info ${isSpeaking ? "is-speaking" : ""}`} onClick={onProfileClick} aria-label="Abrir menu do perfil">
        <span className="sidebar-user-avatar local-user-avatar user-area-avatar">
          <UserAvatar user={user} size={30} />
          <UserStatusBadge status={status} size="md" />
        </span>
        <span className="sidebar-user-copy local-user-copy user-area-copy">
          <strong title={nickname}>{nickname}</strong>
          <span title={label}>{label}</span>
        </span>
      </button>
      <div className="sidebar-user-controls local-user-controls user-area-controls" aria-label="Controles do usuario">
        <div className="user-area-control-slot">
          <button type="button" className={`control-glyph ${micEnabled ? "is-active" : "is-muted"}`} onClick={onToggleMicrophone} disabled={!micAvailable} data-tooltip={micEnabled ? "Silenciar microfone" : "Ativar microfone"} aria-label={micEnabled ? "Silenciar microfone" : "Ativar microfone"} aria-pressed={micEnabled}>
            <Icon name={micEnabled ? "mic" : "micOff"} size={16} />
          </button>
        </div>
        <div className="user-area-control-slot">
          <button type="button" className={`control-glyph ${isDeafened ? "is-muted is-deafened" : "is-active"} ${!deafenAvailable ? "is-unavailable" : ""}`} onClick={onToggleDeafen} disabled={!deafenAvailable} data-tooltip={isDeafened ? "Ativar audio" : "Silenciar audio"} aria-label={isDeafened ? "Ativar audio" : "Silenciar audio"} aria-pressed={isDeafened}>
            <Icon name="headphones" size={16} />
          </button>
        </div>
        <div className="user-area-control-slot">
          <button type="button" className="control-glyph" onClick={onOpenUserSettings} disabled={typeof onOpenUserSettings !== "function"} data-tooltip="Configuracoes" aria-label="Abrir configuracoes">
            <Icon name="settings" size={16} />
          </button>
        </div>
      </div>
    </div>
  </footer>;
}
