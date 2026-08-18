import Icon from "./Icon.jsx";

export default function ControlsBar({
  isScreenSharing,
  onToggleScreenShare
}) {
  return (
    <footer className="call-controls" aria-label="Controles da chamada">
      <button
        className={`control-button ${isScreenSharing ? "is-on" : ""}`}
        type="button"
        onClick={onToggleScreenShare}
        aria-label={isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
      >
        <span className="control-icon" aria-hidden="true"><Icon name="screen" size={15} /></span>
        <span>{isScreenSharing ? "Parar tela" : "Compartilhar"}</span>
      </button>
    </footer>
  );
}
