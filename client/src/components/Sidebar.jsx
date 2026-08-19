import UserStatusBadge from "./UserStatusBadge.jsx";
import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";
import ControlsBar from "./ControlsBar.jsx";
import UserAvatar from "./UserAvatar.jsx";
import { useState } from "react";

export default function Sidebar({
  roomCode,
  roomName,
  participantCount,
  maxParticipants,
  participants,
  selectedChannel,
  onSelectChannel,
  onCopyInvite,
  notify,
  copyFallbackLink,
  nickname,
  status = "Online",
  customStatus = "",
  isGuest = false,
  avatarVariant = 0,
  isInVoice,
  connectionQuality,
  micEnabled,
  cameraEnabled,
  isScreenSharing = false,
  streamPreset = "720p30",
  screenShareLabel = "720p · 30 FPS",
  isDeafened,
  isSpeaking,
  avatarUrl,
  onProfileClick,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
  onStreamPresetChange,
  onToggleDeafen,
  onLeaveVoice,
  onJoinVoice,
  onLeaveRoom
}) {
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      notify?.("Codigo copiado.");
    } catch {
      notify?.("Nao foi possivel copiar o codigo.");
    }
    setIsRoomMenuOpen(false);
  }

  return (
    <aside className="app-sidebar" aria-label="Informacoes da sala">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true"><BrandMark size={30} /></div>
        <div>
          <strong>EchoLive</strong>
          <span>Sua call privada</span>
        </div>
      </div>

      <section className="sidebar-section room-section">
        <div className="room-section-heading"><p className="section-label">Sala atual</p><button type="button" className="room-menu-trigger" onClick={() => setIsRoomMenuOpen((value) => !value)} title="Acoes da sala" aria-label="Acoes da sala"><Icon name="more" size={17} /></button></div>
        <div className="room-name-line" title={roomName || `Sala ${roomCode}`}>{roomName || `Sala ${roomCode}`}</div>
        <div className="room-code-line"><span>Codigo</span><strong title={roomCode}>{roomCode}</strong></div>
        <p className="sidebar-count">
          Participantes: {participantCount}/{maxParticipants || "-"}
        </p>
        {copyFallbackLink && (
          <label className="field compact-field">
            <span>Copie manualmente</span>
            <input readOnly value={copyFallbackLink} onFocus={(event) => event.target.select()} />
          </label>
        )}
        {isRoomMenuOpen && <div className="room-context-menu" role="menu"><button type="button" onClick={() => { onCopyInvite(); setIsRoomMenuOpen(false); }}><Icon name="link" size={15} />Copiar convite</button><button type="button" onClick={copyRoomCode}><Icon name="code" size={15} />Copiar codigo</button><button type="button" onClick={onLeaveRoom} className="danger-menu-item"><Icon name="phoneDisconnect" size={15} />Sair da sala</button></div>}
      </section>

      <section className="sidebar-section channel-section">
        <p className="section-label">Canais de texto</p>
        <button
          type="button"
          className={`channel-button ${selectedChannel === "text-general" ? "is-selected" : ""}`}
          onClick={() => onSelectChannel("text-general")}
        >
          <span className="channel-icon channel-hash" aria-hidden="true">#</span>
          <strong>geral</strong>
        </button>

        <p className="section-label voice-label">Canais de voz</p>
        <button
          type="button"
          className={`channel-button ${selectedChannel === "voice-general" ? "is-selected" : ""}`}
          onClick={() => onSelectChannel("voice-general")}
        >
          <span className="channel-icon" aria-hidden="true"><Icon name="voice" size={16} /></span>
          <strong>Geral</strong>
          <span className="channel-count">{participants.length}</span>
        </button>
        <div className="call-member-list">
          {participants.map((participant) => (
            <div className={`call-member ${participant.isSpeaking ? "is-speaking" : ""} ${participant.isLocal ? "is-local-member" : ""}`} key={participant.socketId} onClick={participant.isLocal ? onProfileClick : undefined} onKeyDown={(event) => { if (participant.isLocal && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onProfileClick?.(); } }} role={participant.isLocal ? "button" : undefined} tabIndex={participant.isLocal ? 0 : undefined}>
              <span className="member-avatar" aria-hidden="true"><UserAvatar user={participant} size={25} /><UserStatusBadge status={participant.status} size="sm" /></span>
              <span className="member-name" title={participant.displayName || participant.nickname}>{participant.displayName || participant.nickname}</span>
              {participant.isGuest && <span className="visitor-badge">Visitante</span>}
              <span className="member-status" aria-label="Status de midia">
                <i className={`status-icon status-mic ${participant.micEnabled === false ? "is-muted" : ""}`} title={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"} aria-label={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"}><Icon name={participant.micEnabled === false ? "micOff" : "mic"} size={14} /></i>
                <i className={`status-icon status-camera ${participant.cameraEnabled === false ? "is-muted" : ""}`} title={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"} aria-label={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"}><Icon name={participant.cameraEnabled === false ? "cameraOff" : "camera"} size={14} /></i>
                {participant.isScreenSharing && <i className="status-icon status-screen is-sharing" title="Compartilhando tela" aria-label="Compartilhando tela"><Icon name="screenShare" size={14} /></i>}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="sidebar-lower-region">
        <section className={`connected-voice ${isInVoice ? "is-connected" : "is-away"}`} aria-label="Status da voz">
          <div className="connected-voice-heading"><span className="voice-state-icon" aria-hidden="true"><Icon name={isInVoice ? "voice" : "headphones"} size={16} /></span><span className="connected-voice-copy"><strong>{isInVoice ? "Voz conectada" : "Fora da voz"}</strong><span className="connected-voice-channel">Geral</span></span>{isInVoice && <span className="connection-quality" title={`Qualidade da conexao: ${connectionQuality}`}><Icon name="signal" size={14} />{connectionQuality}</span>}{isInVoice ? <button type="button" className="connected-voice-action" onClick={onLeaveVoice} data-tooltip="Desconectar" aria-label="Desconectar"><Icon name="phoneDisconnect" size={16} /></button> : <button type="button" className="connected-voice-action" onClick={onJoinVoice} data-tooltip="Entrar na voz" aria-label="Entrar na voz"><Icon name="voice" size={15} /></button>}</div>
        </section>

        {isInVoice && <div className="sidebar-call-toolbar" aria-label="Controles da chamada">
          <button type="button" className={`sidebar-call-button ${cameraEnabled ? "is-active" : "is-muted"}`} onClick={onToggleCamera} data-tooltip={cameraEnabled ? "Desligar camera" : "Ligar camera"} aria-label={cameraEnabled ? "Desligar camera" : "Ligar camera"} aria-pressed={cameraEnabled}>
            <span className="camera-control-icon" aria-hidden="true"><Icon name={cameraEnabled ? "camera" : "cameraOff"} size={15} /></span>
            <span>Camera</span>
          </button>
          <ControlsBar
            compact
            isScreenSharing={isScreenSharing}
            onToggleScreenShare={onToggleScreenShare}
            streamPreset={streamPreset}
            screenShareLabel={screenShareLabel}
            onStreamPresetChange={onStreamPresetChange}
          />
        </div>}

        <footer className="sidebar-user-footer">
        <button type="button" className={`sidebar-user-summary ${isSpeaking ? "is-speaking" : ""}`} onClick={onProfileClick} aria-label="Abrir menu do perfil">
          <span className="sidebar-user-avatar">
            <UserAvatar user={{ nickname, avatarUrl, avatarVariant, isGuest }} size={30} />
            <UserStatusBadge status={status} size="md" />
          </span>
          <div>
            <strong title={nickname}>{nickname}</strong>
            <span title={customStatus || status}>{isGuest ? "Visitante" : customStatus || (isInVoice ? "Em chamada" : status)}</span>
          </div>
        </button>
        <div className="sidebar-user-controls" aria-label="Controles do usuario">
          {isInVoice ? <button type="button" className={`control-glyph ${micEnabled ? "is-active" : "is-muted"}`} onClick={onToggleMicrophone} data-tooltip={micEnabled ? "Silenciar microfone" : "Ativar microfone"} aria-label={micEnabled ? "Silenciar microfone" : "Ativar microfone"}><Icon name={micEnabled ? "mic" : "micOff"} size={16} /></button> : <span />}
          {isInVoice ? <button type="button" className={`control-glyph ${isDeafened ? "is-muted is-deafened" : "is-active"}`} onClick={onToggleDeafen} data-tooltip={isDeafened ? "Ativar audio" : "Silenciar audio"} aria-label={isDeafened ? "Ativar audio" : "Silenciar audio"}><Icon name="headphones" size={16} /></button> : <span />}
        </div>
        </footer>
      </div>
    </aside>
  );
}
