import { useEffect, useRef } from "react";

export default function AudioParticipant({ stream, volume = 100 }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && audioRef.current.srcObject !== stream) {
      audioRef.current.srcObject = stream || null;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  return <audio ref={audioRef} autoPlay playsInline aria-hidden="true" />;
}
