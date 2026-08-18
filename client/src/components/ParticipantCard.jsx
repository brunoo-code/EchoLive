import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

export default function ParticipantCard({
  socketId,
  nickname,
  stream,
  isLocal = false,
  isScreenSharing = false,
  screenShareLabel = "",
  isSpeaking = false,
  avatarUrl = "",
  micEnabled,
  cameraEnabled,
  volume = 100,
  outputDeviceId = "",
  isDeafened = false,
  compact = false,
  onFocus,
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
      videoRef.current.volume = isDeafened ? 0 : volume / 100;
    }
  }, [isDeafened, isLocal, volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLocal || typeof video.setSinkId !== "function") {
      return;
    }
    video.setSinkId(outputDeviceId || "").catch(() => {});
  }, [isLocal, outputDeviceId]);

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
      className={`participant-card ${compact ? "is-compact" : ""} ${isScreenSharing ? "is-sharing" : ""} ${isSpeaking ? "is-speaking" : ""}`}
      data-participant-id={socketId}
      onClick={() => onFocus?.(socketId)}
    >
      <div className="participant-topline">
        <div className="participant-identity">
          <div className="participant-avatar" aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : nickname?.slice(0, 1).toUpperCase() || "?"}
          </div>
          <div>
          <strong title={nickname}>{nickname}</strong>
          {isScreenSharing && <span className="sharing-text">Compartilhando tela{isLocal && screenShareLabel ? ` · ${screenShareLabel}` : ""}</span>}
          </div>
        </div>
        {isLocal && <span className="status-badge">Voce</span>}
      </div>

      <div className="video-frame">
        {stream ? (
          <video className={isScreenSharing ? "screen-video" : "camera-video"} data-video-peer={socketId} ref={videoRef} autoPlay playsInline muted={isLocal} />
        ) : (
          <div className="video-placeholder">
            <div className="placeholder-avatar" aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : nickname?.slice(0, 1).toUpperCase() || "?"}</div>
            <span>Sem video</span>
          </div>
        )}
        {isScreenSharing && <div className="screen-badge">{isLocal && screenShareLabel ? screenShareLabel : "Tela compartilhada"}</div>}
      </div>

      <div className="participant-actions">
        <div className="media-status-row" aria-label="Status de midia">
          {typeof micEnabled === "boolean" && <span className={`status-icon status-mic ${micEnabled ? "status-on" : "status-off"}`} title={micEnabled ? "Microfone ligado" : "Microfone desligado"} aria-label={micEnabled ? "Microfone ligado" : "Microfone desligado"}><Icon name={micEnabled ? "mic" : "micOff"} size={14} /></span>}
          {typeof cameraEnabled === "boolean" && <span className={`status-icon status-camera ${cameraEnabled ? "status-on" : "status-off"}`} title={cameraEnabled ? "Camera ligada" : "Camera desligada"} aria-label={cameraEnabled ? "Camera ligada" : "Camera desligada"}><Icon name={cameraEnabled ? "camera" : "cameraOff"} size={14} /></span>}
        </div>
        {!isLocal && (
          <label className="volume-control">
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) => onVolumeChange?.(Number(event.target.value))}
            />
          </label>
        )}
          <button type="button" onClick={(event) => { event.stopPropagation(); openFullscreen(); }} aria-label={`Abrir tela cheia para ${nickname}`}>
          Tela cheia
        </button>
      </div>
    </article>
  );
}
