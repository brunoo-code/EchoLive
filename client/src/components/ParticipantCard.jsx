import { useEffect, useRef } from "react";

export default function ParticipantCard({
  socketId,
  nickname,
  stream,
  isLocal = false,
  isScreenSharing = false,
  isSpeaking = false,
  avatarUrl = "",
  micEnabled,
  cameraEnabled,
  volume = 100,
  onVolumeChange,
  notify
}) {
  const cardRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && !isLocal) {
      videoRef.current.volume = volume / 100;
    }
  }, [isLocal, volume]);

  async function openFullscreen() {
    const target = videoRef.current || cardRef.current;

    if (!target?.requestFullscreen) {
      notify?.("Tela cheia nao suportada.");
      return;
    }

    try {
      await target.requestFullscreen();
    } catch {
      notify?.("Tela cheia nao suportada.");
    }
  }

  return (
    <article
      ref={cardRef}
      className={`participant-card ${isScreenSharing ? "is-sharing" : ""} ${isSpeaking ? "is-speaking" : ""}`}
      data-participant-id={socketId}
    >
      <div className="participant-topline">
        <div className="participant-identity">
          <div className="participant-avatar" aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : nickname?.slice(0, 1).toUpperCase() || "?"}
          </div>
          <div>
          <strong>{nickname}</strong>
          {isScreenSharing && <span className="sharing-text">Compartilhando tela</span>}
          </div>
        </div>
        <span className="status-badge">{isLocal ? "Voce" : "Remoto"}</span>
      </div>

      <div className="video-frame">
        {stream ? (
          <video ref={videoRef} autoPlay playsInline muted={isLocal} />
        ) : (
          <div className="video-placeholder">
            <div className="placeholder-avatar" aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : nickname?.slice(0, 1).toUpperCase() || "?"}</div>
            <span>Sem video</span>
          </div>
        )}
        {isScreenSharing && <div className="screen-badge">Tela compartilhada</div>}
      </div>

      <div className="participant-actions">
        <div className="media-status-row">
          {typeof micEnabled === "boolean" && <span className={micEnabled ? "status-on" : "status-off"}>{micEnabled ? "Mic" : "Mic off"}</span>}
          {typeof cameraEnabled === "boolean" && <span className={cameraEnabled ? "status-on" : "status-off"}>{cameraEnabled ? "Cam" : "Cam off"}</span>}
        </div>
        {!isLocal && (
          <label className="volume-control">
            <span>Vol</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) => onVolumeChange?.(Number(event.target.value))}
            />
          </label>
        )}
          <button type="button" onClick={openFullscreen} aria-label={`Abrir tela cheia para ${nickname}`}>
          Fullscreen
        </button>
      </div>
    </article>
  );
}
