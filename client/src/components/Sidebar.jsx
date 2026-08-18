export default function Sidebar({
  roomCode,
  roomName,
  participantCount,
  maxParticipants,
  participants,
  selectedChannel,
  onSelectChannel,
  onCopyInvite,
  onEditNickname,
  copyFallbackLink,
  nickname,
  isInVoice,
  connectionQuality,
  micEnabled,
  cameraEnabled,
  isDeafened,
  isSpeaking,
  avatarUrl,
  onAvatarChange,
  onToggleMicrophone,
  onToggleCamera,
  onToggleDeafen,
  onOpenDevices,
  onOpenSettings,
  onLeaveVoice,
  onJoinVoice,
  onLeaveRoom
}) {
  return (
    <aside className="app-sidebar" aria-label="Informacoes da sala">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">EL</div>
        <div>
          <strong>EchoLive</strong>
          <span>Sua call privada</span>
        </div>
      </div>

      <section className="sidebar-section room-section">
        <p className="section-label">Sala atual</p>
        <div className="room-name-line">{roomName || `Sala ${roomCode}`}</div>
        <div className="room-code-line"><span>Codigo</span><strong>{roomCode}</strong></div>
        <p className="sidebar-count">
          Participantes: {participantCount}/{maxParticipants || "-"}
        </p>
        <button type="button" onClick={onCopyInvite} aria-label="Copiar convite da sala">
          Copiar convite
        </button>
        {copyFallbackLink && (
          <label className="field compact-field">
            <span>Copie manualmente</span>
            <input readOnly value={copyFallbackLink} onFocus={(event) => event.target.select()} />
          </label>
        )}
        <button type="button" className="ghost-button" onClick={onEditNickname}>
          Alterar nick
        </button>
      </section>

      <section className={`connected-voice ${isInVoice ? "is-connected" : "is-away"}`} aria-label="Status da voz">
        <div className="connected-voice-heading"><span className="voice-live-dot" aria-hidden="true" /> <strong>{isInVoice ? "Voz conectada" : "Fora da voz"}</strong>{isInVoice && <span className="connection-quality">{connectionQuality}</span>}</div>
        <span className="connected-voice-channel">Geral</span>
        {isInVoice && <button type="button" className="connected-leave" onClick={onLeaveVoice} title="Sair da voz" aria-label="Sair da voz">Sair da voz</button>}
      </section>

      <section className="sidebar-section channel-section">
        <p className="section-label">Canais de texto</p>
        <button
          type="button"
          className={`channel-button ${selectedChannel === "text-general" ? "is-selected" : ""}`}
          onClick={() => onSelectChannel("text-general")}
        >
          <span className="channel-icon" aria-hidden="true">#</span>
          <strong>geral</strong>
        </button>

        <p className="section-label voice-label">Canais de voz</p>
        <button
          type="button"
          className={`channel-button ${selectedChannel === "voice-general" ? "is-selected" : ""}`}
          onClick={() => onSelectChannel("voice-general")}
        >
          <span className="channel-icon" aria-hidden="true">VOL</span>
          <strong>Geral</strong>
          <span className="channel-count">{participants.length}</span>
        </button>
        <div className="call-member-list">
          {participants.map((participant) => (
            <div className={`call-member ${participant.isSpeaking ? "is-speaking" : ""}`} key={participant.socketId}>
              <span className="member-avatar" aria-hidden="true">{participant.avatarUrl ? <img src={participant.avatarUrl} alt="" /> : participant.nickname?.slice(0, 1).toUpperCase() || "?"}</span>
              <span>{participant.nickname}</span>
              <span className="member-status" aria-label="Status de midia">
                <i className={participant.micEnabled === false ? "is-muted" : ""}>M</i>
                <i className={participant.cameraEnabled === false ? "is-muted" : ""}>C</i>
                {participant.isScreenSharing && <i className="is-sharing">T</i>}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="sidebar-user-footer">
        <div className={`sidebar-user-summary ${isSpeaking ? "is-speaking" : ""}`}>
          <label className="sidebar-user-avatar" title="Alterar avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : nickname?.slice(0, 1).toUpperCase() || "?"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarChange} />
          </label>
          <div>
            <strong>{nickname}</strong>
            <span>{isInVoice ? "Em chamada" : "Online"}</span>
          </div>
        </div>
        <div className="sidebar-user-controls" aria-label="Controles do usuario">
          {isInVoice ? <button type="button" className={micEnabled ? "is-active" : "is-muted"} onClick={onToggleMicrophone} title={micEnabled ? "Desligar microfone" : "Ligar microfone"} aria-label={micEnabled ? "Desligar microfone" : "Ligar microfone"}>Mic</button> : <span />}
          {isInVoice ? <button type="button" className={isDeafened ? "is-muted is-deafened" : "is-active"} onClick={onToggleDeafen} title={isDeafened ? "Deixar de ensurdecer" : "Ensurdecer"} aria-label={isDeafened ? "Deixar de ensurdecer" : "Ensurdecer"}>Deaf</button> : <span />}
          {isInVoice ? <button type="button" className={cameraEnabled ? "is-active" : "is-muted"} onClick={onToggleCamera} title={cameraEnabled ? "Desligar camera" : "Ligar camera"} aria-label={cameraEnabled ? "Desligar camera" : "Ligar camera"}>Cam</button> : <span />}
          <button type="button" onClick={onOpenDevices} title="Configurar dispositivos" aria-label="Configurar dispositivos">Disp</button>
          <button type="button" onClick={onOpenSettings} title="Abrir configuracoes" aria-label="Abrir configuracoes">Cfg</button>
          <button type="button" className="leave-room-button" onClick={onLeaveRoom} title="Sair da sala" aria-label="Sair da sala">Sair</button>
        </div>
      </footer>
    </aside>
  );
}
