import UserStatusBadge from "./UserStatusBadge.jsx";
import Icon from "./Icon.jsx";
import BrandMark from "./BrandMark.jsx";
import UserBadges from "./UserBadges.jsx";

export default function ParticipantsPanel({ participants, onProfileClick, onParticipantClick }) {
  return (
    <aside className="participants-panel" aria-label="Participantes online">
      <div className="panel-heading">
          <span><i className="online-indicator" aria-hidden="true" />Online <b className="panel-count">— {participants.length}</b></span>
      </div>

      <div className="online-list">
        {participants.map((participant) => (
          <div className={`online-person ${participant.isSpeaking ? "is-speaking" : ""} ${participant.isLocal ? "is-local-person" : ""}`} key={participant.socketId} onClick={(event) => { const anchor = event.currentTarget.getBoundingClientRect(); if (participant.isLocal) onProfileClick?.(); else onParticipantClick?.(participant, anchor); }} onKeyDown={(event) => { if (event.key !== "Enter" && event.key !== " ") return; event.preventDefault(); const anchor = event.currentTarget.getBoundingClientRect(); if (participant.isLocal) onProfileClick?.(); else onParticipantClick?.(participant, anchor); }} role="button" tabIndex={0}>
            <div className="avatar-dot" aria-hidden="true">
              {participant.avatarUrl ? <img src={participant.avatarUrl} alt="" /> : participant.isGuest ? <BrandMark size={22} variant={participant.avatarVariant} /> : participant.nickname?.slice(0, 1).toUpperCase() || "?"}
              <UserStatusBadge status={participant.status} size="md" />
            </div>
            <div className="online-person-info">
              <strong title={participant.displayName || participant.nickname}>{participant.displayName || participant.nickname}</strong>
              {participant.isLocal && <span className="you-badge">Voce</span>}
              {participant.isGuest && <span className="visitor-badge">Visitante</span>}
              <UserBadges badges={participant.badges} compact />
            </div>
            <div className="mini-status" aria-label="Status de midia">
              <span className={`status-icon status-mic ${participant.micEnabled === false ? "is-muted" : ""}`} title={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"} aria-label={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"}><Icon name={participant.micEnabled === false ? "micOff" : "mic"} size={14} /></span>
              <span className={`status-icon status-camera ${participant.cameraEnabled === false ? "is-muted" : ""}`} title={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"} aria-label={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"}><Icon name={participant.cameraEnabled === false ? "cameraOff" : "camera"} size={14} /></span>
              {participant.isScreenSharing && <span className="status-icon status-screen is-sharing" title="Compartilhando tela" aria-label="Compartilhando tela"><Icon name="screenShare" size={14} /></span>}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
