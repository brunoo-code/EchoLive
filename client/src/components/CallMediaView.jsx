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
    <aside className={`fluxer-screen-share-pip ${variant === "sidebar" ? "is-sidebar" : "is-floating"}`} data-flx="voice.screen-share-pip" aria-label="Midia da chamada em andamento" onClick={openFromPreview}>
      <header className="fluxer-screen-share-pip-header" data-flx="voice.screen-share-pip.header">
        <span>{participant.isScreenSharing ? "Compartilhamento ativo" : "Câmera ativa"}</span>
        <div className="fluxer-screen-share-pip-actions">
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
    <section className="fluxer-call-stage" data-flx="voice.call-stage">
      <header className="fluxer-call-stage-header" data-flx="voice.call-stage.header">
        <div className="fluxer-call-stage-title">
          <span className="fluxer-call-stage-icon"><Icon name="voice" size={17} /></span>
          <div>
            <p className="fluxer-call-stage-eyebrow">Voz</p>
            <p className="fluxer-call-context">{channelName}</p>
          </div>
          <span className="fluxer-call-count">{countLabel}</span>
        </div>
        <div className="fluxer-call-stage-tools" data-flx="voice.call-stage.header-tools">
          <div className="fluxer-call-view-controls" aria-label="Modo de visualização">
            <button type="button" className={`fluxer-call-view-button ${viewMode === "grid" ? "is-selected" : ""}`} onClick={() => onViewModeChange?.("grid")} aria-pressed={viewMode === "grid"}>Grade</button>
            <button type="button" className={`fluxer-call-view-button ${viewMode === "focus" ? "is-selected" : ""}`} onClick={() => { if (!hasVisualMedia) return; onViewModeChange?.("focus"); if (!focusedMediaId) onFocusParticipant?.(focusedParticipant?.socketId || ""); }} aria-pressed={viewMode === "focus"} disabled={!hasVisualMedia}>Foco</button>
          </div>
            <button type="button" className={`fluxer-call-members-toggle ${membersVisible ? "is-selected" : ""}`} onClick={onToggleMembers} aria-pressed={membersVisible} title={membersVisible ? "Ocultar membros" : "Mostrar membros"}>
            <Icon name="user" size={16} />
            <span>Membros</span>
          </button>
        </div>
      </header>

      <div className="fluxer-call-stage-body" data-flx="voice.call-stage.body">
        {isJoining && <p className="status-line">Entrando na sala...</p>}
        {isDisconnected && <p className="status-line danger">Conexão com o servidor perdida.</p>}

        {!isInVoice ? (
          <section className="fluxer-call-empty-surface" data-flx="voice.call-stage.empty-surface" aria-label="Canal de voz vazio" />
        ) : callParticipants.length > 0 ? (
          viewMode === "focus" && hasVisualMedia && focusedParticipant ? (
            <section className="fluxer-call-focus-layout" data-flx="voice.call-stage.focus-layout">
              <div className="fluxer-call-focus-main" data-flx="voice.call-stage.focus-main">{renderParticipantCard(focusedParticipant)}</div>
              <div className="fluxer-call-focus-thumbnails" data-flx="voice.call-stage.focus-thumbnails">
                {callParticipants.filter((participant) => participant.socketId !== focusedParticipant.socketId).map((participant) => renderParticipantCard(participant, true))}
              </div>
            </section>
          ) : (
            <section className={`fluxer-call-participant-grid count-${callParticipants.length} ${callParticipants.some((participant) => participant.isScreenSharing) ? "has-sharing" : ""}`} data-flx="voice.call-stage.participant-grid">
              {callParticipants.map((participant) => renderParticipantCard(participant))}
            </section>
          )
        ) : (
          <section className="fluxer-call-empty-state" data-flx="voice.call-stage.empty-state" aria-label="Chamada sem participantes">
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
