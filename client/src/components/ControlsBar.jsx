import Icon from "./Icon.jsx";
import { useState } from "react";

const presetOptions = [
  ["720p30", "720p · 30 FPS"],
  ["720p60", "720p · 60 FPS"],
  ["1080p30", "1080p · 30 FPS"],
  ["1080p60", "1080p · 60 FPS"]
];

export default function ControlsBar({
  isScreenSharing,
  onToggleScreenShare,
  streamPreset = "720p30",
  screenShareLabel = "720p · 30 FPS",
  onStreamPresetChange,
  compact = false
}) {
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);

  if (compact) {
    return <>
      <button
        className={`control-button call-toolbar-button ${isScreenSharing ? "is-on" : ""}`}
        type="button"
        onClick={onToggleScreenShare}
        title={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"}
        aria-label={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"}
        aria-pressed={isScreenSharing}
      >
        <span className="control-icon" aria-hidden="true"><Icon name="screenShare" size={15} /></span>
        <span>{isScreenSharing ? "Parar tela" : "Compartilhar"}</span>
      </button>
      <div className="screen-options-control">
        <button type="button" className="screen-preset-trigger call-toolbar-button" onClick={() => setIsPresetMenuOpen((value) => !value)} title="Escolher qualidade da transmissao" aria-label="Escolher qualidade da transmissao" aria-haspopup="menu" aria-expanded={isPresetMenuOpen}>
          <Icon name="settings" size={14} />
          <span>Opcoes</span>
        </button>
        {isPresetMenuOpen && <div className="screen-preset-menu" role="menu" aria-label="Qualidade da transmissao">{presetOptions.map(([value, label]) => <button type="button" key={value} className={streamPreset === value ? "is-selected" : ""} onClick={() => { onStreamPresetChange(value); setIsPresetMenuOpen(false); }} role="menuitemradio" aria-checked={streamPreset === value}><span>{label}</span>{value === "1080p60" && <small>Maior uso de conexao e processamento</small>}</button>)}</div>}
      </div>
    </>;
  }

  return (
    <footer className="call-controls" aria-label="Controles da chamada">
      <div className="screen-share-control">
        <button
          className={`control-button ${isScreenSharing ? "is-on" : ""}`}
          type="button"
          onClick={onToggleScreenShare}
          title={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"}
          aria-label={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"}
        >
          <span className="control-icon" aria-hidden="true"><Icon name="screenShare" size={15} /></span>
          <span>{isScreenSharing ? "Parar tela" : "Compartilhar tela"}</span>
          {isScreenSharing && <small>{screenShareLabel}</small>}
        </button>
        <button type="button" className="screen-preset-trigger" onClick={() => setIsPresetMenuOpen((value) => !value)} title="Escolher qualidade da transmissao" aria-label="Escolher qualidade da transmissao" aria-haspopup="menu" aria-expanded={isPresetMenuOpen}><Icon name="settings" size={14} /><Icon name="chevron" size={12} /></button>
        {isPresetMenuOpen && <div className="screen-preset-menu" role="menu" aria-label="Qualidade da transmissao">{presetOptions.map(([value, label]) => <button type="button" key={value} className={streamPreset === value ? "is-selected" : ""} onClick={() => { onStreamPresetChange(value); setIsPresetMenuOpen(false); }} role="menuitemradio" aria-checked={streamPreset === value}><span>{label}</span>{value === "1080p60" && <small>Maior uso de conexao e processamento</small>}</button>)}</div>}
        {isScreenSharing && <p className="screen-share-guidance">Para compartilhar videos ou musica com audio, prefira uma aba do navegador. O audio da tela inteira pode incluir sons da propria chamada.</p>}
      </div>
    </footer>
  );
}
