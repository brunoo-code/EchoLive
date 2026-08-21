import UserStatusBadge from "./UserStatusBadge.jsx";
import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";
import ControlsBar from "./ControlsBar.jsx";
import UserAvatar from "./UserAvatar.jsx";
import { useEffect, useRef, useState } from "react";
import { presenceLabel } from "../utils/presence.js";

export default function Sidebar({
  roomCode,
  roomName,
  roomExpiryLabel = "",
  roomExpiryWarning = "",
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
  onOpenUserSettings,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
  onStreamPresetChange,
  onToggleDeafen,
  onLeaveVoice,
  onJoinVoice,
  onLeaveRoom,
  variant = "room",
  serverName = "",
  serverIconUrl = "",
  serverTextChannels = [],
  serverVoiceChannels = [],
  serverActiveChannelId = "",
  serverVoiceChannelId = "",
  serverVoiceViewedChannelId = "",
  serverConnectedVoiceChannelId = "",
  voiceChannelName = "Geral",
  onSelectServerChannel,
  onToggleServerVoice,
  serverVoiceParticipants = [],
  serverNavigationState = null,
  onServerInvite,
  onServerSettings,
  onServerLeave,
  onServerDelete,
  canManageServer = false,
  canDeleteServer = false,
  onCreateServerChannel,
  onRenameServerChannel,
  onDeleteServerChannel,
  voicePreview = null
}) {
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
  const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
  const [channelMenuId, setChannelMenuId] = useState("");
  const serverMenuRef = useRef(null);
  const isServer = variant === "server";

  useEffect(() => {
    if (!isServerMenuOpen && !channelMenuId) return undefined;

    function closeMenus(event) {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && (serverMenuRef.current?.contains(event.target) || event.target.closest?.(".server-channel-actions, .server-channel-context-menu"))) return;
      setIsServerMenuOpen(false);
      setChannelMenuId("");
    }

    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeMenus);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeMenus);
    };
  }, [channelMenuId, isServerMenuOpen]);

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
    <aside className="app-sidebar" aria-label={isServer ? "Navegacao do servidor" : "Informacoes da sala"}>
      <div className={`brand-block ${isServer ? "server-brand-block" : ""}`} ref={isServer ? serverMenuRef : null}>
        <div className={`brand-mark ${isServer && serverIconUrl ? "has-server-icon" : ""}`} aria-hidden="true">{isServer && serverIconUrl ? <img src={serverIconUrl} alt="" /> : <BrandMark size={30} />}</div>
        <div>
          <strong>{isServer ? serverName || "Seus servidores" : "EchoLive"}</strong>
          {!isServer && <span>Sua call privada</span>}
        </div>
        {isServer && <button type="button" className="server-menu-trigger" onClick={() => { setChannelMenuId(""); setIsServerMenuOpen((value) => !value); }} title="Menu do servidor" aria-label="Menu do servidor" aria-haspopup="menu" aria-expanded={isServerMenuOpen}><Icon name="chevron" size={15} /></button>}
        {isServer && isServerMenuOpen && <div className="server-context-menu" role="menu">
          {onServerInvite && <button type="button" role="menuitem" onClick={() => { setIsServerMenuOpen(false); onServerInvite(); }}><Icon name="account" size={15} />Convidar pessoas</button>}
          {onServerSettings && <button type="button" role="menuitem" onClick={() => { setIsServerMenuOpen(false); onServerSettings(canManageServer ? "overview" : "identity"); }}><Icon name="settings" size={15} />{canManageServer ? "Configurações do servidor" : "Perfil neste servidor"}</button>}
          {canManageServer && onServerSettings && <button type="button" role="menuitem" onClick={() => { setIsServerMenuOpen(false); onServerSettings("overview"); }}><Icon name="edit" size={15} />Editar nome e ícone</button>}
          {canManageServer && onCreateServerChannel && <button type="button" role="menuitem" onClick={() => { setIsServerMenuOpen(false); onCreateServerChannel("text"); }}><Icon name="plus" size={15} />Criar canal</button>}
          {canManageServer && onServerSettings && <button type="button" role="menuitem" onClick={() => { setIsServerMenuOpen(false); onServerSettings("channels"); }}><Icon name="hash" size={15} />Gerenciar canais</button>}
          {canManageServer && onServerSettings && <button type="button" role="menuitem" onClick={() => { setIsServerMenuOpen(false); onServerSettings("members"); }}><Icon name="members" size={15} />Membros</button>}
          {(onServerLeave || (canDeleteServer && onServerDelete)) && <div className="server-menu-divider" />}
          {onServerLeave && <button type="button" role="menuitem" onClick={() => { setIsServerMenuOpen(false); onServerLeave(); }}><Icon name="leave" size={15} />Sair do servidor</button>}
          {canDeleteServer && onServerDelete && <button type="button" role="menuitem" className="danger-menu-item" onClick={() => { setIsServerMenuOpen(false); onServerDelete(); }}><Icon name="trash" size={15} />Excluir servidor</button>}
        </div>}
      </div>

      {!isServer && <section className="sidebar-section room-section">
        <div className="room-section-heading"><p className="section-label">Sala atual</p><button type="button" className="room-menu-trigger" onClick={() => setIsRoomMenuOpen((value) => !value)} title="Acoes da sala" aria-label="Acoes da sala"><Icon name="more" size={17} /></button></div>
        <div className="room-name-line" title={roomName || `Sala ${roomCode}`}>{roomName || `Sala ${roomCode}`}</div>
        <p className="sidebar-count">
          Participantes: {participantCount}/{maxParticipants || "-"}
        </p>
        {roomExpiryLabel && <p className="sidebar-expiry">Sala temporaria · {roomExpiryLabel}</p>}
        {roomExpiryWarning && <div className="sidebar-expiry-warning" role="status">{roomExpiryWarning}</div>}
        {copyFallbackLink && (
          <label className="field compact-field">
            <span>Copie manualmente</span>
            <input readOnly value={copyFallbackLink} onFocus={(event) => event.target.select()} />
          </label>
        )}
        {isRoomMenuOpen && <div className="room-context-menu" role="menu"><button type="button" onClick={() => { onCopyInvite(); setIsRoomMenuOpen(false); }}><Icon name="link" size={15} />Copiar convite</button><button type="button" onClick={copyRoomCode}><Icon name="code" size={15} />Copiar codigo</button><button type="button" onClick={onLeaveRoom} className="danger-menu-item"><Icon name="phoneDisconnect" size={15} />Sair da sala</button></div>}
      </section>}

      {!isServer ? <section className="sidebar-section channel-section">
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
          className={`channel-button ${selectedChannel === "voice-general" ? "is-selected" : ""} ${isInVoice ? "is-connected" : ""}`}
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
      </section> : <section className="sidebar-section channel-section server-channel-section">
         {serverNavigationState || <ServerChannelNavigation channels={serverTextChannels} voiceChannels={serverVoiceChannels} activeChannelId={serverActiveChannelId} voiceChannelId={serverVoiceChannelId} viewedVoiceChannelId={serverVoiceViewedChannelId} connectedVoiceChannelId={serverConnectedVoiceChannelId} onSelectChannel={onSelectServerChannel} onToggleVoice={onToggleServerVoice} participants={serverVoiceParticipants} canManageServer={canManageServer} onCreateChannel={onCreateServerChannel} channelMenuId={channelMenuId} onToggleChannelMenu={(channelId) => { setIsServerMenuOpen(false); setChannelMenuId((current) => current === channelId ? "" : channelId); }} onRenameChannel={(channel) => { setChannelMenuId(""); onRenameServerChannel?.(channel); }} onDeleteChannel={(channel) => { setChannelMenuId(""); onDeleteServerChannel?.(channel); }} />}
      </section>}

      <div className="sidebar-lower-region">
        {isInVoice && <section className={`connected-voice is-connected ${voicePreview ? "has-preview" : ""}`} aria-label="Status da voz">
          {voicePreview && <div className="connected-voice-preview">{voicePreview}</div>}
          <div className="connected-voice-heading"><span className="voice-state-icon" aria-hidden="true"><Icon name={isInVoice ? "voice" : "headphones"} size={16} /></span><span className="connected-voice-copy"><strong>{isInVoice ? "Voz conectada" : "Fora da voz"}</strong><span className="connected-voice-channel">{voiceChannelName}</span></span>{isInVoice && connectionQuality && <span className="connection-quality" title={`Qualidade da conexao: ${connectionQuality}`}><Icon name="signal" size={14} />{connectionQuality}</span>}{isInVoice ? <button type="button" className="connected-voice-action" onClick={onLeaveVoice} data-tooltip="Desconectar" aria-label="Desconectar"><Icon name="phoneDisconnect" size={16} /></button> : <button type="button" className="connected-voice-action" onClick={onJoinVoice} data-tooltip="Entrar na voz" aria-label="Entrar na voz"><Icon name="voice" size={15} /></button>}</div>
          <div className="sidebar-call-toolbar" aria-label="Controles da chamada">
            <button type="button" className={`sidebar-call-button ${cameraEnabled ? "is-active" : "is-muted"}`} onClick={onToggleCamera} data-tooltip={cameraEnabled ? "Desligar camera" : "Ligar camera"} aria-label={cameraEnabled ? "Desligar camera" : "Ligar camera"} aria-pressed={cameraEnabled}>
              <span className="camera-control-icon" aria-hidden="true"><Icon name={cameraEnabled ? "camera" : "cameraOff"} size={15} /></span>
              <span>Camera</span>
            </button>
            <ControlsBar compact isScreenSharing={isScreenSharing} onToggleScreenShare={onToggleScreenShare} streamPreset={streamPreset} screenShareLabel={screenShareLabel} onStreamPresetChange={onStreamPresetChange} />
          </div>
        </section>}

        <footer className="sidebar-user-footer">
        <button type="button" className={`sidebar-user-summary ${isSpeaking ? "is-speaking" : ""}`} onClick={onProfileClick} aria-label="Abrir menu do perfil">
          <span className="sidebar-user-avatar">
            <UserAvatar user={{ nickname, avatarUrl, avatarVariant, isGuest }} size={30} />
            <UserStatusBadge status={status} size="md" />
          </span>
          <div>
            <strong title={nickname}>{nickname}</strong>
            <span title={isGuest ? "Visitante" : presenceLabel(status)}>{isGuest ? "Visitante" : presenceLabel(status)}</span>
          </div>
        </button>
        <div className="sidebar-user-controls" aria-label="Controles do usuario">
          {isInVoice && <button type="button" className={`control-glyph ${micEnabled ? "is-active" : "is-muted"}`} onClick={onToggleMicrophone} data-tooltip={micEnabled ? "Silenciar microfone" : "Ativar microfone"} aria-label={micEnabled ? "Silenciar microfone" : "Ativar microfone"}><Icon name={micEnabled ? "mic" : "micOff"} size={16} /></button>}
          {isInVoice && onToggleDeafen && <button type="button" className={`control-glyph ${isDeafened ? "is-muted is-deafened" : "is-active"}`} onClick={onToggleDeafen} data-tooltip={isDeafened ? "Ativar audio" : "Silenciar audio"} aria-label={isDeafened ? "Ativar audio" : "Silenciar audio"}><Icon name="headphones" size={16} /></button>}
          {onOpenUserSettings && <button type="button" className="control-glyph" onClick={onOpenUserSettings} data-tooltip="Configuracoes" aria-label="Abrir configuracoes"><Icon name="settings" size={16} /></button>}
        </div>
        </footer>
      </div>
    </aside>
  );
}

function ServerChannelNavigation({ channels, voiceChannels, activeChannelId, voiceChannelId, viewedVoiceChannelId, connectedVoiceChannelId, onSelectChannel, onToggleVoice, participants, canManageServer, onCreateChannel, channelMenuId, onToggleChannelMenu, onRenameChannel, onDeleteChannel }) {
  return <>
    <div className="server-channel-heading"><p className="section-label">Canais de texto</p>{canManageServer && <button type="button" className="server-channel-add" onClick={() => onCreateChannel?.("text")} title="Criar canal de texto" aria-label="Criar canal de texto"><Icon name="plus" size={14} /></button>}</div>
    {channels.map((channel) => <ServerChannelRow key={channel.id} channel={channel} selected={channel.id === activeChannelId} canManage={canManageServer} menuOpen={channelMenuId === channel.id} onSelect={() => onSelectChannel?.(channel.id)} onToggleMenu={() => onToggleChannelMenu?.(channel.id)} onRename={() => onRenameChannel?.(channel)} onDelete={() => onDeleteChannel?.(channel)} />)}
    <div className="server-channel-heading voice-label"><p className="section-label">Canais de voz</p>{canManageServer && <button type="button" className="server-channel-add" onClick={() => onCreateChannel?.("voice")} title="Criar canal de voz" aria-label="Criar canal de voz"><Icon name="plus" size={14} /></button>}</div>
    {voiceChannels.map((channel) => (
      <div key={channel.id}>
        <ServerChannelRow channel={channel} selected={channel.id === viewedVoiceChannelId} connected={channel.id === connectedVoiceChannelId} count={channel.id === voiceChannelId ? participants.length : ""} canManage={canManageServer} menuOpen={channelMenuId === channel.id} onSelect={() => onToggleVoice?.(channel.id)} onToggleMenu={() => onToggleChannelMenu?.(channel.id)} onRename={() => onRenameChannel?.(channel)} onDelete={() => onDeleteChannel?.(channel)} />
        {channel.id === (connectedVoiceChannelId || voiceChannelId) && <div className="call-member-list">
          {participants.map((participant) => (
            <div className={`call-member ${participant.isSpeaking ? "is-speaking" : ""} ${participant.isLocal ? "is-local-member" : ""}`} key={participant.socketId}>
              <span className="member-avatar" aria-hidden="true"><UserAvatar user={participant} size={25} /><UserStatusBadge status={participant.status} size="sm" /></span>
              <span className="member-name" title={participant.displayName || participant.nickname}>{participant.displayName || participant.nickname}</span>
              <span className="member-status" aria-label="Status de midia">
                <i className={`status-icon status-mic ${participant.micEnabled === false ? "is-muted" : ""}`} title={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"} aria-label={participant.micEnabled === false ? "Microfone desligado" : "Microfone ligado"}><Icon name={participant.micEnabled === false ? "micOff" : "mic"} size={14} /></i>
                <i className={`status-icon status-camera ${participant.cameraEnabled === false ? "is-muted" : ""}`} title={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"} aria-label={participant.cameraEnabled === false ? "Camera desligada" : "Camera ligada"}><Icon name={participant.cameraEnabled === false ? "cameraOff" : "camera"} size={14} /></i>
                {participant.isScreenSharing && <i className="status-icon status-screen is-sharing" title="Compartilhando tela" aria-label="Compartilhando tela"><Icon name="screenShare" size={14} /></i>}
              </span>
            </div>
          ))}
        </div>}
      </div>
    ))}
  </>;
}

function ServerChannelRow({ channel, selected, connected, count = "", canManage, menuOpen, onSelect, onToggleMenu, onRename, onDelete }) {
  return <div className="server-channel-row">
    <button type="button" className={`channel-button ${selected ? "is-selected" : ""} ${connected ? "is-connected" : ""}`} onClick={onSelect}>
      <span className={`channel-icon ${channel.type === "text" ? "channel-hash" : ""}`} aria-hidden="true">{channel.type === "text" ? "#" : <Icon name="voice" size={16} />}</span>
      <strong>{channel.name}</strong>
      {count !== "" && <span className="channel-count">{count}</span>}
    </button>
    {canManage && <button type="button" className="server-channel-actions" onClick={onToggleMenu} title={`Ações de ${channel.name}`} aria-label={`Ações de ${channel.name}`} aria-haspopup="menu" aria-expanded={menuOpen}><Icon name="more" size={15} /></button>}
    {canManage && menuOpen && <div className="server-channel-context-menu" role="menu">
      <button type="button" role="menuitem" onClick={onRename}><Icon name="edit" size={14} />Renomear canal</button>
      <button type="button" role="menuitem" className="danger-menu-item" onClick={onDelete}><Icon name="trash" size={14} />Excluir canal</button>
    </div>}
  </div>;
}
