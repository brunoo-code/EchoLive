import { useEffect, useRef } from "react";

function clampVolume(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue)) : 100;
}

export default function AudioParticipant({ peerSocketId, stream, volume = 100, isDeafened = false, outputDeviceId = "" }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && audioRef.current.srcObject !== stream) {
      audioRef.current.srcObject = stream || null;
      if (stream) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [stream]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const normalizedVolume = clampVolume(volume);
      audio.volume = isDeafened ? 0 : normalizedVolume / 100;
    }
  }, [isDeafened, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || typeof audio.setSinkId !== "function") {
      return;
    }
    audio.setSinkId(outputDeviceId || "").catch(() => {});
  }, [outputDeviceId]);

  return <audio ref={audioRef} data-audio-peer={peerSocketId} autoPlay muted={false} playsInline aria-hidden="true" />;
}
