/* SPDX-License-Identifier: AGPL-3.0-or-later
 * Presentational structure directly derived from Fluxer VoiceControlBar.tsx
 * and VoiceControlBar.module.css; EchoLive owns every action and media state.
 */
import Icon from "./Icon.jsx";
import { useState } from "react";

const presetOptions = [
  ["720p30", "720p · 30 FPS"],
  ["720p60", "720p · 60 FPS"],
  ["1080p30", "1080p · 30 FPS"],
  ["1080p60", "1080p · 60 FPS"]
];

function IconControl({ label, icon, active = false, danger = false, onClick, pressed, disabled = false }) {
  return (
    <div className="fluxer-voice-control-button-container">
      <button
        className={`fluxer-voice-control-button ${active ? "is-on" : ""} ${danger ? "is-danger" : ""}`}
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
      >
        <Icon name={icon} size={18} />
      </button>
    </div>
  );
}

function PresetMenu({ streamPreset, onStreamPresetChange, isOpen, onToggle }) {
  return (
      <div className="fluxer-screen-options-control fluxer-voice-control-button-container">
      <button
        type="button"
        className="fluxer-screen-preset-trigger fluxer-voice-control-button"
        onClick={onToggle}
        title="Opções da transmissão"
        aria-label="Opções da transmissão"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Icon name="more" size={18} />
      </button>
      {isOpen && (
        <div className="fluxer-screen-preset-menu" role="menu" aria-label="Qualidade da transmissão">
          <p className="fluxer-menu-kicker">Qualidade da transmissão</p>
          {presetOptions.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={streamPreset === value ? "is-selected" : ""}
              onClick={() => { onStreamPresetChange?.(value); onToggle(); }}
              role="menuitemradio"
              aria-checked={streamPreset === value}
            >
              <span>{label}</span>
              {value === "1080p60" && <small>Maior uso de conexão e processamento</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ControlsBar({
  isScreenSharing,
  onToggleScreenShare,
  streamPreset = "720p30",
  screenShareLabel = "720p · 30 FPS",
  onStreamPresetChange,
  compact = false,
  micEnabled = false,
  onToggleMicrophone,
  cameraEnabled = false,
  onToggleCamera,
  isDeafened = false,
  onToggleDeafen,
  onLeaveVoice
}) {
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const togglePresetMenu = () => setIsPresetMenuOpen((value) => !value);

  if (compact) {
    return (
      <div className="fluxer-voice-control-bar fluxer-voice-control-bar-compact" data-flx="voice.voice-control-bar" aria-label="Controles de voz">
        <IconControl label={cameraEnabled ? "Desligar camera" : "Ligar camera"} icon={cameraEnabled ? "camera" : "cameraOff"} active={cameraEnabled} pressed={cameraEnabled} onClick={onToggleCamera} />
        <IconControl label={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"} icon="screenShare" active={isScreenSharing} pressed={isScreenSharing} onClick={onToggleScreenShare} />
        <PresetMenu streamPreset={streamPreset} onStreamPresetChange={onStreamPresetChange} isOpen={isPresetMenuOpen} onToggle={togglePresetMenu} />
      </div>
    );
  }

  return (
    <footer className="fluxer-voice-control-bar" data-flx="voice.voice-control-bar" aria-label="Controles da chamada">
      <IconControl label={micEnabled ? "Silenciar microfone" : "Ativar microfone"} icon={micEnabled ? "mic" : "micOff"} active={micEnabled} pressed={micEnabled} onClick={onToggleMicrophone} />
      <IconControl label={isDeafened ? "Ativar áudio" : "Desativar áudio"} icon={isDeafened ? "speaker" : "headphones"} active={isDeafened} pressed={isDeafened} onClick={onToggleDeafen} />
      <IconControl label={cameraEnabled ? "Desligar câmera" : "Ligar câmera"} icon={cameraEnabled ? "camera" : "cameraOff"} active={cameraEnabled} pressed={cameraEnabled} onClick={onToggleCamera} />
      <div className="fluxer-screen-share-control">
        <IconControl label={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"} icon="screenShare" active={isScreenSharing} pressed={isScreenSharing} onClick={onToggleScreenShare} />
        {isScreenSharing && <span className="fluxer-screen-share-state" title={screenShareLabel}>{screenShareLabel}</span>}
      </div>
      <PresetMenu streamPreset={streamPreset} onStreamPresetChange={onStreamPresetChange} isOpen={isPresetMenuOpen} onToggle={togglePresetMenu} />
      <IconControl label="Desconectar da voz" icon="phoneDisconnect" danger onClick={onLeaveVoice} />
    </footer>
  );
}
