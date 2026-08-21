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
          <div className={`online-person ${participant.isSpeaking ? "is-speaking" : ""} ${participant.isLocal ? "is-local-person" : ""}`} key={participant.socketId} onClick={(event) => { const anchor = event.currentTarget.getBoundingClientRect(); if (participant.isLocal) onProfileClick?.(participant.rawUser || participant, anchor); else onParticipantClick?.(participant.rawUser || participant, anchor); }} onKeyDown={(event) => { if (event.key !== "Enter" && event.key !== " ") return; event.preventDefault(); const anchor = event.currentTarget.getBoundingClientRect(); if (participant.isLocal) onProfileClick?.(participant.rawUser || participant, anchor); else onParticipantClick?.(participant.rawUser || participant, anchor); }} role="button" tabIndex={0}>
            <div className="avatar-dot" aria-hidden="true">
              <UserAvatar user={participant} size={30} />
              <UserStatusBadge status={participant.status} size="md" />
            </div>
            <div className="online-person-info">
              <strong title={participant.displayName || participant.nickname}>{participant.displayName || participant.nickname}</strong>
              {participant.isLocal && <span className="you-badge">Voce</span>}
              {participant.isGuest && <span className="visitor-badge">Visitante</span>}
              {participant.secondaryText && <span>{participant.secondaryText}</span>}
            </div>
            {showMedia && <div className="mini-status" aria-label="Status de midia">
              <span className={`status-icon status-mic ${participant.micEnabled === false ? "is-muted" : ""}`} title={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"} aria-label={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"}><Icon name={participant.micEnabled === false ? "micOff" : "mic"} size={14} /></span>
              <span className={`status-icon status-camera ${participant.cameraEnabled === false ? "is-muted" : ""}`} title={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"} aria-label={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"}><Icon name={participant.cameraEnabled === false ? "cameraOff" : "camera"} size={14} /></span>
              {participant.isScreenSharing && <span className="status-icon status-screen is-sharing" title="Compartilhando tela" aria-label="Compartilhando tela"><Icon name="screenShare" size={14} /></span>}
            </div>}
          </div>
        ))}
      </div>
    </aside>
  );
}
