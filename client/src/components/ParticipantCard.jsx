import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";
import UserAvatar from "./UserAvatar.jsx";

function clampVolume(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue)) : 100;
}

export default function ParticipantCard({
  socketId,
  nickname,
  stream,
  isLocal = false,
  isScreenSharing = false,
  screenShareLabel = "",
  isSpeaking = false,
  avatarUrl = "",
  isGuest = false,
  avatarVariant = 0,
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
  const hasVideo = Boolean(stream && (isScreenSharing || cameraEnabled));

  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== (hasVideo ? stream : null)) {
      videoRef.current.srcObject = hasVideo ? stream : null;
    }
  }, [hasVideo, stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && !isLocal) {
      const normalizedVolume = clampVolume(volume);
      video.volume = isDeafened ? 0 : normalizedVolume / 100;
      if (!isDeafened && video.muted) {
        video.muted = false;
      }
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

  function handleNativeVolumeChange(event) {
    if (isLocal || isDeafened || !onVolumeChange) {
      return;
    }

    const nextVolume = clampVolume(Math.round(event.currentTarget.volume * 100));
    if (nextVolume !== clampVolume(volume)) {
      onVolumeChange(nextVolume);
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
            <UserAvatar user={{ nickname, avatarUrl, avatarVariant, isGuest }} size={28} />
          </div>
          <div>
          <strong title={nickname}>{nickname}</strong>
          {isGuest && <span className="visitor-badge">Visitante</span>}
          {isScreenSharing && <span className="sharing-text">Compartilhando tela{isLocal && screenShareLabel ? ` · ${screenShareLabel}` : ""}</span>}
          </div>
        </div>
        {isLocal && <span className="status-badge">Voce</span>}
      </div>

      <div className="video-frame">
        {hasVideo ? (
          <video className={isScreenSharing ? "screen-video" : "camera-video"} data-video-peer={socketId} ref={videoRef} autoPlay playsInline muted={isLocal} onVolumeChange={handleNativeVolumeChange} />
        ) : (
          <div className="video-placeholder">
            <div className="placeholder-avatar" aria-hidden="true"><UserAvatar user={{ nickname, avatarUrl, avatarVariant, isGuest }} size={40} /></div>
            <span>{isScreenSharing ? "Tela indisponível" : "Sem câmera"}</span>
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
            <span>{isScreenSharing ? "Volume da transmissao" : "Volume"}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={clampVolume(volume)}
              aria-label={isScreenSharing ? "Volume da transmissao" : `Volume de ${nickname}`}
              onChange={(event) => onVolumeChange?.(clampVolume(event.target.value))}
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
