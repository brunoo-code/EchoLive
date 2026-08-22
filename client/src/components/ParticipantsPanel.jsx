/* SPDX-License-Identifier: AGPL-3.0-or-later. Presentation hierarchy directly derived from Fluxer member rows. */
import UserStatusBadge from "./UserStatusBadge.jsx";
import Icon from "./Icon.jsx";
import UserAvatar from "./UserAvatar.jsx";

export default function ParticipantsPanel({ participants, onProfileClick, onParticipantClick, showMedia = true, heading = "Online", showPresenceIndicator = true }) {
  return (
    <aside className="fluxer-member-list" aria-label={heading} data-flx="channel.member-list.member-list">
      <div className="fluxer-member-list-header" data-flx="channel.member-list.header">
          <span>{showPresenceIndicator && <i className="fluxer-member-presence-indicator" aria-hidden="true" />}{heading} <b className="fluxer-member-count">— {participants.length}</b></span>
      </div>

      <div className="fluxer-member-list-scroller" data-flx="channel.member-list.scroller">
        {participants.map((participant) => (
          <button type="button" className={`fluxer-member-row ${participant.isSpeaking ? "is-speaking" : ""} ${participant.isLocal ? "is-local-person" : ""}`} key={participant.socketId} onClick={(event) => { const anchor = event.currentTarget.getBoundingClientRect(); if (participant.isLocal) onProfileClick?.(participant.rawUser || participant, anchor); else onParticipantClick?.(participant.rawUser || participant, anchor); }} data-flx="channel.member-list.member-row">
            <div className="fluxer-member-row-grid">
              <span className="fluxer-member-row-avatar" aria-hidden="true">
              <UserAvatar user={participant} size={32} />
              <UserStatusBadge status={participant.status} size="md" />
              </span>
              <span className="fluxer-member-row-content">
                <span className="fluxer-member-name-container">
                  <strong title={participant.displayName || participant.nickname}>{participant.displayName || participant.nickname}</strong>
                  {participant.isGuest && <span className="visitor-badge">Visitante</span>}
                </span>
                {participant.secondaryText && <span className="fluxer-member-status">{participant.secondaryText}</span>}
              </span>
              {showMedia && <div className="fluxer-member-action-cluster" aria-label="Status de midia">
              <span className={`fluxer-member-media-icon status-mic ${participant.micEnabled === false ? "is-muted" : ""}`} title={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"} aria-label={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"}><Icon name={participant.micEnabled === false ? "micOff" : "mic"} size={14} /></span>
              <span className={`fluxer-member-media-icon status-camera ${participant.cameraEnabled === false ? "is-muted" : ""}`} title={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"} aria-label={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"}><Icon name={participant.cameraEnabled === false ? "cameraOff" : "camera"} size={14} /></span>
              {participant.isScreenSharing && <span className="fluxer-member-media-icon status-screen is-sharing" title="Compartilhando tela" aria-label="Compartilhando tela"><Icon name="screenShare" size={14} /></span>}
              </div>}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
