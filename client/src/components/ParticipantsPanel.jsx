/* SPDX-License-Identifier: AGPL-3.0-or-later. Presentation hierarchy directly derived from Fluxer member rows. */
import UserStatusBadge from "./UserStatusBadge.jsx";
import Icon from "./Icon.jsx";
import UserAvatar from "./UserAvatar.jsx";

export default function ParticipantsPanel({ participants, onProfileClick, onParticipantClick, showMedia = true, heading = "Online", showPresenceIndicator = true }) {
  return (
    <aside className="participants-panel" aria-label={heading}>
      <div className="panel-heading">
          <span>{showPresenceIndicator && <i className="online-indicator" aria-hidden="true" />}{heading} <b className="panel-count">— {participants.length}</b></span>
      </div>

      <div className="online-list">
        {participants.map((participant) => (
          <button type="button" className={`online-person member-list-item ${participant.isSpeaking ? "is-speaking" : ""} ${participant.isLocal ? "is-local-person" : ""}`} key={participant.socketId} onClick={(event) => { const anchor = event.currentTarget.getBoundingClientRect(); if (participant.isLocal) onProfileClick?.(participant.rawUser || participant, anchor); else onParticipantClick?.(participant.rawUser || participant, anchor); }}>
            <div className="member-list-grid">
              <div className="avatar-dot member-avatar-stack" aria-hidden="true">
              <UserAvatar user={participant} size={32} />
              <UserStatusBadge status={participant.status} size="md" />
              </div>
              <div className="online-person-info member-main">
                <span className="online-person-name-row">
                  <strong title={participant.displayName || participant.nickname}>{participant.displayName || participant.nickname}</strong>
                  {participant.isGuest && <span className="visitor-badge">Visitante</span>}
                </span>
                {participant.secondaryText && <span className="online-person-role">{participant.secondaryText}</span>}
              </div>
              {showMedia && <div className="mini-status member-action-cluster" aria-label="Status de midia">
              <span className={`status-icon status-mic ${participant.micEnabled === false ? "is-muted" : ""}`} title={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"} aria-label={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"}><Icon name={participant.micEnabled === false ? "micOff" : "mic"} size={14} /></span>
              <span className={`status-icon status-camera ${participant.cameraEnabled === false ? "is-muted" : ""}`} title={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"} aria-label={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"}><Icon name={participant.cameraEnabled === false ? "cameraOff" : "camera"} size={14} /></span>
              {participant.isScreenSharing && <span className="status-icon status-screen is-sharing" title="Compartilhando tela" aria-label="Compartilhando tela"><Icon name="screenShare" size={14} /></span>}
              </div>}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
