export default function ParticipantsPanel({ participants }) {
  return (
    <aside className="participants-panel" aria-label="Participantes online">
      <div className="panel-heading">
          <span><i className="online-indicator" aria-hidden="true" />Online</span>
          <strong>{participants.length}</strong>
      </div>

      <div className="online-list">
        {participants.map((participant) => (
          <div className={`online-person ${participant.isSpeaking ? "is-speaking" : ""}`} key={participant.socketId}>
            <div className="avatar-dot" aria-hidden="true">
              {participant.avatarUrl ? <img src={participant.avatarUrl} alt="" /> : participant.nickname?.slice(0, 1).toUpperCase() || "?"}
            </div>
            <div className="online-person-info">
              <strong>{participant.nickname}</strong>
              {participant.isLocal && <span className="you-badge">Voce</span>}
            </div>
            <div className="mini-status" aria-label="Status de midia">
              <span className={participant.micEnabled === false ? "is-muted" : ""} title={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"}>M</span>
              <span className={participant.cameraEnabled === false ? "is-muted" : ""} title={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"}>C</span>
              {participant.isScreenSharing && <span className="is-sharing" title="Compartilhando tela">T</span>}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
