import UserStatusBadge from "./UserStatusBadge.jsx";
import Icon from "./Icon.jsx";

export default function ParticipantsPanel({ participants, onProfileClick }) {
  return (
    <aside className="participants-panel" aria-label="Participantes online">
      <div className="panel-heading">
          <span><i className="online-indicator" aria-hidden="true" />Online</span>
          <strong className="panel-count">{participants.length}</strong>
      </div>

      <div className="online-list">
        {participants.map((participant) => (
          <div className={`online-person ${participant.isSpeaking ? "is-speaking" : ""} ${participant.isLocal ? "is-local-person" : ""}`} key={participant.socketId} onClick={participant.isLocal ? onProfileClick : undefined} role={participant.isLocal ? "button" : undefined} tabIndex={participant.isLocal ? 0 : undefined}>
            <div className="avatar-dot" aria-hidden="true">
              {participant.avatarUrl ? <img src={participant.avatarUrl} alt="" /> : participant.nickname?.slice(0, 1).toUpperCase() || "?"}
              <UserStatusBadge status={participant.status} size="md" />
            </div>
            <div className="online-person-info">
              <strong title={participant.displayName || participant.nickname}>{participant.displayName || participant.nickname}</strong>
              {participant.isLocal && <span className="you-badge">Voce</span>}
            </div>
            <div className="mini-status" aria-label="Status de midia">
              <span className={`status-icon status-mic ${participant.micEnabled === false ? "is-muted" : ""}`} title={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"} aria-label={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"}><Icon name="mic" size={14} /></span>
              <span className={`status-icon status-camera ${participant.cameraEnabled === false ? "is-muted" : ""}`} title={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"} aria-label={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"}><Icon name="camera" size={14} /></span>
              {participant.isScreenSharing && <span className="status-icon status-screen is-sharing" title="Compartilhando tela" aria-label="Compartilhando tela"><Icon name="screen" size={14} /></span>}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
