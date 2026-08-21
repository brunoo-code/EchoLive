import ParticipantCard from "./ParticipantCard.jsx";
import ControlsBar from "./ControlsBar.jsx";
import Icon from "./Icon.jsx";

export function MediaPip({
  participant,
  onOpen,
  onClose,
  isDeafened = false,
  outputDeviceId = "",
  screenShareLabel = "",
  volume = 100,
  onVolumeChange,
  notify,
  variant = "floating"
}) {
  if (!participant) return null;

  function openFromPreview(event) {
    if (event.target.closest("button, input, a")) return;
    onOpen?.();
  }

  return (
    <aside className={`call-pip-preview ${variant === "sidebar" ? "is-sidebar" : "is-floating"}`} aria-label="Midia da chamada em andamento" onClick={openFromPreview}>
      <header className="call-pip-header">
        <span>{participant.isScreenSharing ? "Compartilhamento ativo" : "Câmera ativa"}</span>
        <div className="call-pip-actions">
          <button type="button" onClick={onOpen} title="Abrir chamada" aria-label="Abrir chamada"><Icon name="screen" size={14} /></button>
          <button type="button" onClick={onClose} title="Fechar preview" aria-label="Fechar preview"><Icon name="close" size={14} /></button>
        </div>
      </header>
      <ParticipantCard {...participant} compact screenShareLabel={participant.isLocal ? screenShareLabel : ""} isDeafened={isDeafened} outputDeviceId={outputDeviceId} volume={volume} onVolumeChange={onVolumeChange} notify={notify} />
    </aside>
  );
}

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
  notify,
  micEnabled = false,
  onToggleMicrophone,
  cameraEnabled = false,
  onToggleCamera,
  isScreenSharing = false,
  onToggleScreenShare,
  onToggleDeafen,
  onLeaveVoice,
  membersVisible = false,
  onToggleMembers,
  streamPreset = "720p30",
  onStreamPresetChange
}) {
  const callParticipants = participants
    .filter((participant) => participant && participant.inRoom !== false)
    .slice()
    .sort((left, right) => Number(right.isScreenSharing) - Number(left.isScreenSharing));
  const hasVisualMedia = callParticipants.some((participant) => Boolean(
    participant.stream && (participant.isScreenSharing || participant.cameraEnabled)
  ));
  const focusedParticipant = callParticipants.find((participant) => participant.socketId === focusedMediaId)
    || callParticipants.find((participant) => participant.stream && (participant.isScreenSharing || participant.cameraEnabled))
    || callParticipants[0];
  const countLabel = Number.isFinite(maxParticipants) ? `${participantCount}/${maxParticipants}` : participantCount;

  function focusParticipant(socketId) {
    if (!hasVisualMedia) return;
    const participant = callParticipants.find((item) => item.socketId === socketId);
    if (!participant?.stream || (!participant.isScreenSharing && !participant.cameraEnabled)) return;
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
      <header className="room-header call-stage-header">
        <div className="call-stage-title">
          <span className="call-stage-icon"><Icon name="voice" size={17} /></span>
          <div>
            <p className="eyebrow">Voz</p>
            <p className="call-context-line">{channelName}</p>
          </div>
          <span className="call-stage-count">{countLabel}</span>
        </div>
        <div className="room-meta">
          <div className="call-view-controls" aria-label="Modo de visualização">
            <button type="button" className={viewMode === "grid" ? "is-selected" : ""} onClick={() => onViewModeChange?.("grid")} aria-pressed={viewMode === "grid"}>Grade</button>
            <button type="button" className={viewMode === "focus" ? "is-selected" : ""} onClick={() => { if (!hasVisualMedia) return; onViewModeChange?.("focus"); if (!focusedMediaId) onFocusParticipant?.(focusedParticipant?.socketId || ""); }} aria-pressed={viewMode === "focus"} disabled={!hasVisualMedia}>Foco</button>
          </div>
          <button type="button" className={`call-members-toggle ${membersVisible ? "is-selected" : ""}`} onClick={onToggleMembers} aria-pressed={membersVisible} title={membersVisible ? "Ocultar membros" : "Mostrar membros"}>
            <Icon name="user" size={16} />
            <span>Membros</span>
          </button>
        </div>
      </header>

      <div className="call-stage-body">
        {isJoining && <p className="status-line">Entrando na sala...</p>}
        {isDisconnected && <p className="status-line danger">Conexão com o servidor perdida.</p>}

        {!isInVoice ? (
          <section className="voice-empty-surface" aria-label="Canal de voz vazio" />
        ) : callParticipants.length > 0 ? (
          viewMode === "focus" && hasVisualMedia && focusedParticipant ? (
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
          <section className="voice-empty-state" aria-label="Chamada sem participantes">
            <strong>Você está na voz</strong>
            <span>Ative a câmera ou aguarde alguém entrar.</span>
          </section>
        )}
      </div>

      <ControlsBar
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={onToggleScreenShare}
        streamPreset={streamPreset}
        screenShareLabel={screenShareLabel}
        onStreamPresetChange={onStreamPresetChange}
        micEnabled={micEnabled}
        onToggleMicrophone={onToggleMicrophone}
        cameraEnabled={cameraEnabled}
        onToggleCamera={onToggleCamera}
        isDeafened={isDeafened}
        onToggleDeafen={onToggleDeafen}
        onLeaveVoice={onLeaveVoice}
      />
    </section>
  );
}
