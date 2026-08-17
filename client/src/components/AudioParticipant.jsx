import { useEffect, useRef } from "react";

export default function AudioParticipant({ peerSocketId, stream, volume = 100, outputDeviceId = "" }) {
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
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || typeof audio.setSinkId !== "function") {
      return;
    }
    audio.setSinkId(outputDeviceId || "").catch(() => {});
  }, [outputDeviceId]);

  return <audio ref={audioRef} data-audio-peer={peerSocketId} autoPlay muted={false} playsInline aria-hidden="true" />;
}
