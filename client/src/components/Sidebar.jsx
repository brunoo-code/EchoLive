import UserStatusBadge from "./UserStatusBadge.jsx";
import BrandMark from "./BrandMark.jsx";
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
  isInVoice,
  connectionQuality,
  micEnabled,
  cameraEnabled,
  isDeafened,
  isSpeaking,
  avatarUrl,
  onProfileClick,
  onToggleMicrophone,
  onToggleCamera,
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
        <div className="brand-mark" aria-hidden="true"><BrandMark size={28} /></div>
        <div>
          <strong>EchoLive</strong>
          <span>Sua call privada</span>
        </div>
      </div>

      <section className="sidebar-section room-section">
        <div className="room-section-heading"><p className="section-label">Sala atual</p><button type="button" className="room-menu-trigger" onClick={() => setIsRoomMenuOpen((value) => !value)} title="Acoes da sala" aria-label="Acoes da sala">...</button></div>
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
        {isRoomMenuOpen && <div className="room-context-menu" role="menu"><button type="button" onClick={() => { onCopyInvite(); setIsRoomMenuOpen(false); }}>Copiar convite</button><button type="button" onClick={copyRoomCode}>Copiar codigo</button><button type="button" onClick={onLeaveRoom} className="danger-menu-item">Sair da sala</button></div>}
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
          <span className="channel-icon sound-wave-icon" aria-hidden="true" />
          <strong>Geral</strong>
          <span className="channel-count">{participants.length}</span>
        </button>
        <div className="call-member-list">
          {participants.map((participant) => (
            <div className={`call-member ${participant.isSpeaking ? "is-speaking" : ""} ${participant.isLocal ? "is-local-member" : ""}`} key={participant.socketId} onClick={participant.isLocal ? onProfileClick : undefined} role={participant.isLocal ? "button" : undefined} tabIndex={participant.isLocal ? 0 : undefined}>
              <span className="member-avatar" aria-hidden="true">{participant.avatarUrl ? <img src={participant.avatarUrl} alt="" /> : participant.nickname?.slice(0, 1).toUpperCase() || "?"}<UserStatusBadge status={participant.status} size="sm" /></span>
              <span className="member-name" title={participant.nickname}>{participant.nickname}</span>
              <span className="member-status" aria-label="Status de midia">
                <i className={`status-icon status-mic ${participant.micEnabled === false ? "is-muted" : ""}`} title={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"} aria-label={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"}>mic</i>
                <i className={`status-icon status-camera ${participant.cameraEnabled === false ? "is-muted" : ""}`} title={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"} aria-label={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"}>cam</i>
                {participant.isScreenSharing && <i className="status-icon status-screen is-sharing" title="Compartilhando tela" aria-label="Compartilhando tela">tela</i>}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="sidebar-lower-region">
        <section className={`connected-voice ${isInVoice ? "is-connected" : "is-away"}`} aria-label="Status da voz">
          <div className="connected-voice-heading"><span className="voice-live-dot" aria-hidden="true" /> <strong>{isInVoice ? "Voz conectada" : "Fora da voz"}</strong>{isInVoice && <span className="connection-quality">{connectionQuality}</span>}</div>
          <span className="connected-voice-channel">Geral</span>
          {isInVoice && <button type="button" className="connected-leave" onClick={onLeaveVoice} title="Sair da voz" aria-label="Sair da voz">Sair da voz</button>}
        </section>

        <footer className="sidebar-user-footer">
        <button type="button" className={`sidebar-user-summary ${isSpeaking ? "is-speaking" : ""}`} onClick={onProfileClick} aria-label="Abrir menu do perfil">
          <span className="sidebar-user-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : nickname?.slice(0, 1).toUpperCase() || "?"}
            <UserStatusBadge status={status} size="md" />
          </span>
          <div>
            <strong title={nickname}>{nickname}</strong>
            <span title={customStatus || status}>{customStatus || (isInVoice ? "Em chamada" : status)}</span>
          </div>
        </button>
        <div className="sidebar-user-controls" aria-label="Controles do usuario">
          {isInVoice ? <button type="button" className={`control-glyph ${micEnabled ? "is-active" : "is-muted"}`} onClick={onToggleMicrophone} title={micEnabled ? "Desligar microfone" : "Ligar microfone"} aria-label={micEnabled ? "Desligar microfone" : "Ligar microfone"}>mic</button> : <span />}
          {isInVoice ? <button type="button" className={`control-glyph ${isDeafened ? "is-muted is-deafened" : "is-active"}`} onClick={onToggleDeafen} title={isDeafened ? "Ativar audio" : "Silenciar audio"} aria-label={isDeafened ? "Ativar audio" : "Silenciar audio"}>audio</button> : <span />}
          {isInVoice ? <button type="button" className={`control-glyph ${cameraEnabled ? "is-active" : "is-muted"}`} onClick={onToggleCamera} title={cameraEnabled ? "Desligar camera" : "Ligar camera"} aria-label={cameraEnabled ? "Desligar camera" : "Ligar camera"}>cam</button> : <span />}
        </div>
        </footer>
      </div>
    </aside>
  );
}
