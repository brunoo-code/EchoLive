import { useEffect, useRef, useState } from "react";
import { createMixedAudioTrack, getDefaultScreenShareConstraints, requestInitialMedia, requestScreenShareStream, requestSingleKind, stopStream } from "../utils/media.js";
import { createVoiceCallEngine } from "../utils/voiceCallEngine.js";
import { getPeerConnectionConfig } from "../utils/webrtc.js";
import { playUiSound } from "../utils/uiSounds.js";

export default function useServerVoiceCall({ socket, serverId, channelId, identity, enabled, notify, uiSounds = true }) {
  const [connected, setConnected] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const engineRef = useRef(null);
  const peersRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const streamsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const audioTrackRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const mixedAudioTrackRef = useRef(null);
  const audioMixContextRef = useRef(null);
  const iceConfigRef = useRef({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  const mediaPromiseRef = useRef(null);
  const uiSoundsRef = useRef(uiSounds);
  uiSoundsRef.current = uiSounds;

  function teardownAudioMix() {
    audioMixContextRef.current?.close?.().catch(() => {});
    audioMixContextRef.current = null;
    mixedAudioTrackRef.current?.stop();
    mixedAudioTrackRef.current = null;
  }

  useEffect(() => {
    if (!socket || !enabled || !serverId || !channelId) return undefined;
    let active = true;

    const applyParticipants = (next) => {
      if (!active) return;
      setRemoteParticipants((current) => next.map((participant) => ({
        ...current.find((item) => item.socketId === participant.socketId),
        ...participant,
        stream: streamsRef.current.get(participant.socketId) || null
      })));
    };

    async function setupLocalMedia() {
      if (localStreamRef.current) return;
      if (mediaPromiseRef.current) return mediaPromiseRef.current;
      mediaPromiseRef.current = (async () => {
        const media = await requestInitialMedia(notify, {});
        if (!active) {
          stopStream(media.stream);
          return;
        }
        localStreamRef.current = media.stream;
        audioTrackRef.current = media.audioTrack;
        cameraTrackRef.current = media.videoTrack;
        setLocalStream(media.stream);
        setMicEnabled(Boolean(media.audioTrack?.enabled));
        setCameraEnabled(Boolean(media.videoTrack?.enabled));
        engineRef.current?.replaceTrack("audio", media.audioTrack);
        engineRef.current?.replaceTrack("video", media.videoTrack);
      })();
      try {
        await mediaPromiseRef.current;
      } finally {
        mediaPromiseRef.current = null;
      }
    }

    function emitMediaStatus() {
      socket.emit("server:voice-media-status", {
        micEnabled: Boolean(audioTrackRef.current?.enabled),
        cameraEnabled: Boolean(cameraTrackRef.current?.enabled),
        isScreenSharing: Boolean(screenTrackRef.current)
      });
    }

    function cleanupLocalMedia() {
      stopStream(screenStreamRef.current);
      stopStream(localStreamRef.current);
      screenStreamRef.current = null;
      screenTrackRef.current = null;
      localStreamRef.current = null;
      audioTrackRef.current = null;
      cameraTrackRef.current = null;
      setLocalStream(null);
      setScreenStream(null);
      setMicEnabled(false);
      setCameraEnabled(false);
      setIsScreenSharing(false);
    }

    engineRef.current = createVoiceCallEngine({
      socket,
      peerStore: peersRef.current,
      pendingIceStore: pendingIceRef.current,
      remoteStreamsStore: streamsRef.current,
      getIceConfig: () => iceConfigRef.current,
      getLocalTracks: () => ({
        audio: mixedAudioTrackRef.current || audioTrackRef.current,
        video: screenTrackRef.current || cameraTrackRef.current
      }),
      onRemoteStream: (remoteSocketId, stream) => {
        setRemoteStreams((current) => ({ ...current, [remoteSocketId]: stream }));
        setRemoteParticipants((current) => current.map((participant) => (
          participant.socketId === remoteSocketId ? { ...participant, stream } : participant
        )));
      }
    });
    const detachSignaling = engineRef.current.attachSignaling({ prepareLocalMedia: setupLocalMedia });

    const handleUsers = async ({ participants = [] } = {}) => {
      setConnected(true);
      applyParticipants(participants);
      await setupLocalMedia();
      participants.forEach((participant) => engineRef.current?.createPeer(participant.socketId, true, true));
      emitMediaStatus();
    };
    const handleJoined = ({ participant } = {}) => {
      if (!participant || participant.socketId === socket.id) return;
      setRemoteParticipants((current) => current.some((item) => item.socketId === participant.socketId)
        ? current
        : [...current, participant]);
      engineRef.current?.createPeer(participant.socketId, false, false);
    };
    const handleLeft = ({ participant } = {}) => {
      if (!participant) return;
      engineRef.current?.removePeer(participant.socketId);
      setRemoteParticipants((current) => current.filter((item) => item.socketId !== participant.socketId));
      setRemoteStreams((current) => {
        const next = { ...current };
        delete next[participant.socketId];
        return next;
      });
    };
    const handleMedia = ({ from, micEnabled: nextMic, cameraEnabled: nextCamera, isScreenSharing: nextShare } = {}) => {
      setRemoteParticipants((current) => current.map((participant) => participant.socketId === from
        ? { ...participant, micEnabled: Boolean(nextMic), cameraEnabled: Boolean(nextCamera), isScreenSharing: Boolean(nextShare) }
        : participant));
    };
    const handleVoiceLeft = () => {
      setConnected(false);
      engineRef.current?.closePeers();
      teardownAudioMix();
      cleanupLocalMedia();
    };

    socket.on("server:voice-users", handleUsers);
    socket.on("server:voice-user-joined", handleJoined);
    socket.on("server:voice-user-left", handleLeft);
    socket.on("server:voice-media-status", handleMedia);
    socket.on("server:voice-left", handleVoiceLeft);

    getPeerConnectionConfig().then((config) => {
      if (!active) return;
      if (config) iceConfigRef.current = config;
      socket.emit("server:voice-join", { serverId, channelId }, (result) => {
        if (!result?.ok && active) notify(result?.error || "Nao foi possivel entrar no canal de voz.");
        if (result?.ok && active) playUiSound("voice-join", uiSoundsRef.current);
      });
    }).catch(() => {
      if (active) {
        socket.emit("server:voice-join", { serverId, channelId });
        playUiSound("voice-join", uiSoundsRef.current);
      }
    });

    return () => {
      active = false;
      socket.emit("server:voice-leave", { serverId, channelId });
      socket.off("server:voice-users", handleUsers);
      socket.off("server:voice-user-joined", handleJoined);
      socket.off("server:voice-user-left", handleLeft);
      socket.off("server:voice-media-status", handleMedia);
      socket.off("server:voice-left", handleVoiceLeft);
      detachSignaling();
      engineRef.current?.closePeers();
      engineRef.current = null;
      teardownAudioMix();
      cleanupLocalMedia();
      setConnected(false);
      setRemoteParticipants([]);
      setRemoteStreams({});
    };
  }, [channelId, enabled, notify, serverId, socket]);

  async function toggleMicrophone() {
    const track = audioTrackRef.current;
    if (!track) return;
    track.enabled = !track.enabled;
    setMicEnabled(track.enabled);
    playUiSound(track.enabled ? "mic-unmute" : "mic-mute", uiSoundsRef.current);
    socket?.emit("server:voice-media-status", {
      micEnabled: track.enabled,
      cameraEnabled: Boolean(cameraTrackRef.current?.enabled),
      isScreenSharing: Boolean(screenTrackRef.current)
    });
  }

  async function toggleCamera() {
    if (cameraTrackRef.current) {
      cameraTrackRef.current.enabled = !cameraTrackRef.current.enabled;
      setCameraEnabled(cameraTrackRef.current.enabled);
      socket?.emit("server:voice-media-status", {
        micEnabled: Boolean(audioTrackRef.current?.enabled),
        cameraEnabled: cameraTrackRef.current.enabled,
        isScreenSharing: Boolean(screenTrackRef.current)
      });
      return;
    }
    const result = await requestSingleKind("video");
    if (!result.track) {
      notify("Permissao de camera negada.");
      return;
    }
    cameraTrackRef.current = result.track;
    localStreamRef.current?.addTrack(result.track);
    engineRef.current?.replaceTrack("video", screenTrackRef.current || result.track);
    setLocalStream(localStreamRef.current);
    setCameraEnabled(true);
    socket?.emit("server:voice-media-status", {
      micEnabled: Boolean(audioTrackRef.current?.enabled),
      cameraEnabled: true,
      isScreenSharing: Boolean(screenTrackRef.current)
    });
  }

  async function stopScreenShare() {
    if (!screenTrackRef.current) return;
    stopStream(screenStreamRef.current);
    teardownAudioMix();
    screenStreamRef.current = null;
    screenTrackRef.current = null;
    engineRef.current?.replaceTrack("video", cameraTrackRef.current);
    engineRef.current?.replaceTrack("audio", audioTrackRef.current);
    setIsScreenSharing(false);
    setScreenStream(null);
    playUiSound("screen-stop", uiSoundsRef.current);
    socket?.emit("screen-share-status", { isScreenSharing: false });
    socket?.emit("server:voice-media-status", {
      micEnabled: Boolean(audioTrackRef.current?.enabled),
      cameraEnabled: Boolean(cameraTrackRef.current?.enabled),
      isScreenSharing: false
    });
  }

  async function toggleScreenShare() {
    if (!enabled || !socket) return;
    if (screenTrackRef.current) {
      await stopScreenShare();
      return;
    }
    try {
      const stream = await requestScreenShareStream(getDefaultScreenShareConstraints());
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      screenStreamRef.current = stream;
      screenTrackRef.current = track;
      setScreenStream(stream);
      const displayAudioTrack = stream.getAudioTracks()[0] || null;
      if (displayAudioTrack) {
        const mixedAudio = createMixedAudioTrack(displayAudioTrack, audioTrackRef.current);
        if (mixedAudio?.track) {
          audioMixContextRef.current = mixedAudio.context;
          mixedAudioTrackRef.current = mixedAudio.track;
          engineRef.current?.replaceTrack("audio", mixedAudio.track);
        }
      }
      engineRef.current?.replaceTrack("video", track);
      track.onended = () => { void stopScreenShare(); };
      setIsScreenSharing(true);
      playUiSound("screen-start", uiSoundsRef.current);
      socket.emit("screen-share-status", { isScreenSharing: true });
      socket.emit("server:voice-media-status", {
        micEnabled: Boolean(audioTrackRef.current?.enabled),
        cameraEnabled: Boolean(cameraTrackRef.current?.enabled),
        isScreenSharing: true
      });
    } catch {}
  }

  function leave() {
    if (enabled) {
      socket?.emit("server:voice-leave", { serverId, channelId });
      playUiSound("voice-leave", uiSoundsRef.current);
    }
  }

  const localParticipant = identity ? {
    ...identity,
    socketId: socket?.id || "local",
    isLocal: true,
    isGuest: false,
    isScreenSharing,
    isSpeaking: false,
    micEnabled,
    cameraEnabled,
    stream: isScreenSharing ? screenStream || localStream : localStream
  } : null;
  const participants = localParticipant && connected ? [localParticipant, ...remoteParticipants] : remoteParticipants;

  return {
    connected,
    participants,
    remoteStreams,
    localStream,
    screenStream,
    micEnabled,
    cameraEnabled,
    isScreenSharing,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    leave
  };
}
