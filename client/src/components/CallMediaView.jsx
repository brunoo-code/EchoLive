import ParticipantCard from "./ParticipantCard.jsx";

export default function CallMediaView({
  participants = [],
  channelName = "Geral",
  participantCount = participants.length,
  maxParticipants,
  isInVoice = false,
  isJoining = false,
  isDisconnected = false,
  viewMode = "grid",
  onViewModeChange,
  focusedMediaId = "",
  onFocusParticipant,
  isDeafened = false,
  outputDeviceId = "",
  screenShareLabel = "",
  volumeById = {},
  onVolumeChange,
  notify
}) {
  const callParticipants = participants
    .filter((participant) => participant.isScreenSharing || (participant.cameraEnabled && participant.stream))
    .sort((left, right) => Number(right.isScreenSharing) - Number(left.isScreenSharing));
  const focusedParticipant = callParticipants.find((participant) => participant.socketId === focusedMediaId) || callParticipants[0];
  const countLabel = Number.isFinite(maxParticipants) ? `${participantCount}/${maxParticipants}` : participantCount;

  function focusParticipant(socketId) {
    onFocusParticipant?.(socketId);
    onViewModeChange?.("focus");
  }

  function renderParticipantCard(participant, compact = false) {
    return (
      <ParticipantCard
        key={`${compact ? "thumb" : "main"}-${participant.socketId}`}
        {...participant}
        screenShareLabel={participant.isLocal ? screenShareLabel : ""}
        compact={compact}
        isDeafened={isDeafened}
        notify={notify}
        outputDeviceId={outputDeviceId}
        volume={volumeById[participant.socketId] ?? participant.volume ?? 100}
        onFocus={focusParticipant}
        onVolumeChange={onVolumeChange ? (volume) => onVolumeChange(participant.socketId, volume) : undefined}
      />
    );
  }

  return (
    <section className="call-stage channel-view">
      <header className="room-header">
        <div>
          <p className="eyebrow">Voz</p>
          <p className="call-context-line">{channelName}</p>
        </div>
        <div className="room-meta">
          <span>Participantes: {countLabel}</span>
          <div className="call-view-controls" aria-label="Modo de visualizacao">
            <button type="button" className={viewMode === "grid" ? "is-selected" : ""} onClick={() => onViewModeChange?.("grid")} aria-pressed={viewMode === "grid"}>Grade</button>
            <button type="button" className={viewMode === "focus" ? "is-selected" : ""} onClick={() => { onViewModeChange?.("focus"); if (!focusedMediaId) onFocusParticipant?.(callParticipants[0]?.socketId || ""); }} aria-pressed={viewMode === "focus"} disabled={!callParticipants.length}>Foco</button>
          </div>
        </div>
      </header>

      {isJoining && <p className="status-line">Entrando na sala...</p>}
      {isDisconnected && <p className="status-line danger">Conexao com o servidor perdida.</p>}

      {!isInVoice ? (
        <section className="voice-empty-surface" aria-label="Canal de voz vazio" />
      ) : callParticipants.length > 0 ? (
        viewMode === "focus" && focusedParticipant ? (
          <section className="focus-layout">
            <div className="focus-main">{renderParticipantCard(focusedParticipant)}</div>
            <div className="focus-thumbnails">
              {callParticipants.filter((participant) => participant.socketId !== focusedParticipant.socketId).map((participant) => renderParticipantCard(participant, true))}
            </div>
          </section>
        ) : (
          <section className={`participants-grid count-${callParticipants.length} ${callParticipants.some((participant) => participant.isScreenSharing) ? "has-sharing" : ""}`}>
            {callParticipants.map((participant) => renderParticipantCard(participant))}
          </section>
        )
      ) : (
        <section className="voice-empty-surface" aria-label="Canal de voz vazio" />
      )}
    </section>
  );
}
