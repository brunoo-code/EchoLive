import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import ChatPanel from "../components/ChatPanel.jsx";
import AudioParticipant from "../components/AudioParticipant.jsx";
import AuthModal from "../components/AuthModal.jsx";
import DevicesModal from "../components/DevicesModal.jsx";
import SettingsModal from "../components/SettingsModal.jsx";
import ParticipantCard from "../components/ParticipantCard.jsx";
import ParticipantsPanel from "../components/ParticipantsPanel.jsx";
import Sidebar from "../components/Sidebar.jsx";
import RoomSwitcherModal from "../components/RoomSwitcherModal.jsx";
import RoomRail from "../components/RoomRail.jsx";
import ProfilePopover from "../components/ProfilePopover.jsx";
import SocialUserProfilePopover from "../components/SocialUserProfilePopover.jsx";
import Icon from "../components/Icon.jsx";
import ToastStack from "../components/ToastStack.jsx";
import useToasts from "../hooks/useToasts.js";
import { requestInitialMedia, requestSingleKind, stopStream } from "../utils/media.js";
import { getPeerConnectionConfig, SERVER_URL } from "../utils/webrtc.js";
import { playUiSound } from "../utils/uiSounds.js";
import { getGuestAvatarVariant, getGuestIdentity } from "../utils/guestIdentity.js";
import { useAuth } from "../auth/AuthContext.jsx";

const NICKNAME_KEY = "echolive.nickname";
const AUDIO_DEVICE_KEY = "echolive.audioDeviceId";
const VIDEO_DEVICE_KEY = "echolive.videoDeviceId";
const OUTPUT_DEVICE_KEY = "echolive.audioOutputDeviceId";
const AVATAR_KEY = "echolive.avatarUrl";
const THEME_KEY = "echolive.theme";
const UI_SOUNDS_KEY = "echolive.uiSounds";
const CONFIRM_LEAVE_KEY = "echolive.confirmLeaveRoom";
const PROFILE_KEY = "echolive.profile";
const RECENT_ROOMS_KEY = "echolive.recentRooms";
const ACCENT_KEY = "echolive.accentColor";
const STREAM_PRESET_KEY = "echolive.streamPreset";
const STREAM_PRESETS = {
  "720p30": { width: 1280, height: 720, frameRate: 30, maxBitrate: 3_500_000, label: "720p · 30 FPS" },
  "720p60": { width: 1280, height: 720, frameRate: 60, maxBitrate: 5_000_000, label: "720p · 60 FPS" },
  "1080p30": { width: 1920, height: 1080, frameRate: 30, maxBitrate: 6_000_000, label: "1080p · 30 FPS" },
  "1080p60": { width: 1920, height: 1080, frameRate: 60, maxBitrate: 8_000_000, label: "1080p · 60 FPS" }
};

function getScreenShareConstraints(preset = "720p30") {
  const selectedPreset = STREAM_PRESETS[preset] || STREAM_PRESETS["720p30"];
  return {
    width: { ideal: selectedPreset.width },
    height: { ideal: selectedPreset.height },
    frameRate: { ideal: selectedPreset.frameRate, max: selectedPreset.frameRate }
  };
}

function getStreamPresetLabel(preset = "720p30") {
  return (STREAM_PRESETS[preset] || STREAM_PRESETS["720p30"]).label;
}

function getActualScreenLabel(settings, fallbackPreset) {
  if (!settings?.width || !settings?.height || !settings?.frameRate) return getStreamPresetLabel(fallbackPreset);
  const resolution = settings.height >= 1000 ? "1080p" : "720p";
  return `${resolution} · ${Math.round(settings.frameRate)} FPS`;
}

export default function RoomPage({ roomCode, onBack, onNavigateRoom, onNavigateSocial }) {
  const { logout, updateProfile: updateAccountProfile, status: authStatus, user: accountUser } = useAuth();
  const debugRtc = new URLSearchParams(window.location.search).get("debugRtc") === "1";
  const [guestIdentity] = useState(() => getGuestIdentity());
  const [guestAvatarVariant, setGuestAvatarVariant] = useState(() => guestIdentity.avatarVariant);
  const [nickname, setNickname] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [joinState, setJoinState] = useState("idle");
  const [roomError, setRoomError] = useState("");
  const [selfId, setSelfId] = useState("");
  const [socketInstance, setSocketInstance] = useState(null);
  const [displayStream, setDisplayStream] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [roomParticipants, setRoomParticipants] = useState([]);
  const [isInVoice, setIsInVoice] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem(ACCENT_KEY) || "#22d3ee");
  const [streamPreset, setStreamPreset] = useState(() => {
    const saved = localStorage.getItem(STREAM_PRESET_KEY);
    return STREAM_PRESETS[saved] ? saved : "720p30";
  });
  const [screenShareSettings, setScreenShareSettings] = useState(null);
  const [uiSounds, setUiSounds] = useState(() => localStorage.getItem(UI_SOUNDS_KEY) !== "false");
  const [confirmLeaveRoom, setConfirmLeaveRoom] = useState(() => localStorage.getItem(CONFIRM_LEAVE_KEY) !== "false");
  const [copyFallbackLink, setCopyFallbackLink] = useState("");
  const [authModalMode, setAuthModalMode] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("voice-general");
  const [activeContentView, setActiveContentView] = useState("media");
  const [messages, setMessages] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [focusedMediaId, setFocusedMediaId] = useState("");
  const [rtcDiagnostics, setRtcDiagnostics] = useState([]);
  const [isDevicesModalOpen, setIsDevicesModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [isRoomSwitcherOpen, setIsRoomSwitcherOpen] = useState(false);
  const [isProfilePopoverOpen, setIsProfilePopoverOpen] = useState(false);
  const [selectedParticipantProfile, setSelectedParticipantProfile] = useState(null);
  const [settingsInitialSection, setSettingsInitialSection] = useState("profile");
  const [recentRoomsRevision, setRecentRoomsRevision] = useState(0);
  const [devices, setDevices] = useState({ audio: [], video: [] });
  const [selectedAudioId, setSelectedAudioId] = useState(() => localStorage.getItem(AUDIO_DEVICE_KEY) || "");
  const [selectedVideoId, setSelectedVideoId] = useState(() => localStorage.getItem(VIDEO_DEVICE_KEY) || "");
  const [selectedOutputId, setSelectedOutputId] = useState(() => localStorage.getItem(OUTPUT_DEVICE_KEY) || "");
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem(AVATAR_KEY) || "");
  const [profile, setProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
      const nextProfile = { displayName: "", nickname: localStorage.getItem(NICKNAME_KEY) || "", status: "online", customStatus: "", avatarUrl: localStorage.getItem(AVATAR_KEY) || "", ...saved };
      return { ...nextProfile, status: nextProfile.status === "dnd" ? "dnd" : "online" };
    } catch {
      return { displayName: "", nickname: "", status: "online", customStatus: "", avatarUrl: "" };
    }
  });
  const { toasts, notify } = useToasts();

  const socketRef = useRef(null);
  const peersRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const localMediaPromiseRef = useRef(null);
  const audioTrackRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const displayAudioTrackRef = useRef(null);
  const mixedAudioTrackRef = useRef(null);
  const audioMixContextRef = useRef(null);
  const microphoneGainRef = useRef(null);
  const iceConfigRef = useRef({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  const hasJoinedRef = useRef(false);
  const connectionStartedRef = useRef(false);
  const lifecycleTokenRef = useRef(null);
  const micEnabledRef = useRef(false);
  const cameraEnabledRef = useRef(false);
  const screenSharingRef = useRef(false);
  const speakingRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const speechSourceRef = useRef(null);
  const speechFrameRef = useRef(null);
  const isInVoiceRef = useRef(true);
  const statsHistoryRef = useRef(new Map());

  const inviteLink = useMemo(() => `${window.location.origin}/room/${roomCode}`, [roomCode]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const safeColor = /^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : "#22d3ee";
    root.style.setProperty("--accent", safeColor);
    root.style.setProperty("--accent-soft", `${safeColor}1f`);
    root.style.setProperty("--accent-border", `${safeColor}66`);
    localStorage.setItem(ACCENT_KEY, safeColor);
  }, [accentColor]);

  useEffect(() => {
    localStorage.setItem(UI_SOUNDS_KEY, String(uiSounds));
  }, [uiSounds]);

  useEffect(() => {
    localStorage.setItem(CONFIRM_LEAVE_KEY, String(confirmLeaveRoom));
  }, [confirmLeaveRoom]);

  useEffect(() => {
    if (!isProfilePopoverOpen) return undefined;
    function closeOnOutside(event) {
      if (!event.target.closest(".profile-popover, .sidebar-user-summary")) setIsProfilePopoverOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setIsProfilePopoverOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [isProfilePopoverOpen]);

  useEffect(() => {
    const localFocused = focusedMediaId === "local" || focusedMediaId === selfId;
    const localMediaActive = Boolean(displayStream && (cameraEnabled || isScreenSharing));
    const remoteMediaActive = remoteParticipants.some((participant) => participant.socketId === focusedMediaId && participant.stream && (participant.cameraEnabled || participant.isScreenSharing));
    if (focusedMediaId && !((localFocused && localMediaActive) || remoteMediaActive)) {
      setFocusedMediaId("");
    }
  }, [focusedMediaId, selfId, displayStream, cameraEnabled, isScreenSharing, remoteParticipants]);

  useEffect(() => {
    const lifecycleToken = Symbol("room-lifecycle");
    lifecycleTokenRef.current = lifecycleToken;
    localStorage.removeItem("nickname");
    localStorage.removeItem("echolive.roomCode");

    if (authStatus === "guest" || (authStatus === "authenticated" && accountUser)) {
      const identity = accountUser
        ? {
            nickname: accountUser.displayName || accountUser.username,
            displayName: accountUser.displayName || accountUser.username,
            username: accountUser.username,
            avatarUrl: accountUser.avatarUrl || localStorage.getItem(AVATAR_KEY) || "",
            isGuest: false,
            avatarVariant: 0
          }
        : guestIdentity;
      setNickname(identity.nickname);
      enterRoom(identity.nickname, lifecycleToken, identity);
    }

    const handleBeforeUnload = () => {
      socketRef.current?.emit("leave-room");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (lifecycleTokenRef.current === lifecycleToken) {
        lifecycleTokenRef.current = null;
        cleanupRoom();
      }
    };
  }, [accountUser, authStatus, guestIdentity]);

  useEffect(() => {
    if (!debugRtc) {
      return undefined;
    }

    let cancelled = false;
    async function refreshRtcDiagnostics() {
      const diagnostics = await Promise.all(
        Array.from(peersRef.current.entries()).map(([peerSocketId, peer]) => collectPeerDiagnostics(peerSocketId, peer))
      );
      if (!cancelled) {
        setRtcDiagnostics(diagnostics);
      }
    }

    refreshRtcDiagnostics();
    const timer = window.setInterval(refreshRtcDiagnostics, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [debugRtc, hasJoined]);

  async function enterRoom(rawNickname, lifecycleToken = lifecycleTokenRef.current, identity = guestIdentity) {
    const cleanNickname = rawNickname.trim().slice(0, 24);
    const requestedAuthenticated = !identity.isGuest;

    if (!cleanNickname) {
      notify("Informe um nickname.");
      return;
    }

    if (hasJoinedRef.current || connectionStartedRef.current) {
      return;
    }

    connectionStartedRef.current = true;
    if (!identity.isGuest) {
      localStorage.setItem(NICKNAME_KEY, cleanNickname);
    } else {
      localStorage.removeItem(NICKNAME_KEY);
    }
    setNickname(cleanNickname);
    setRoomError("");
    setJoinState("joining");
    iceConfigRef.current = await getPeerConnectionConfig();

    if (lifecycleTokenRef.current !== lifecycleToken) {
      connectionStartedRef.current = false;
      return;
    }

    const socket = io(SERVER_URL, { withCredentials: true });
    socketRef.current = socket;
    setSocketInstance(socket);

    socket.on("connect", () => {
      setSelfId(socket.id);
      console.info("[room-join-client]", {
        roomCode,
        normalizedRoom: roomCode,
        socketId: socket.id,
        authenticated: requestedAuthenticated,
        participantId: requestedAuthenticated ? accountUser?.id || null : null
      });
      socket.emit("join-room", {
        roomCode,
        nickname: cleanNickname,
        identity: {
          displayName: identity.displayName || cleanNickname,
          username: identity.username || "",
          avatarUrl: identity.isGuest ? "" : identity.avatarUrl || "",
          avatarVariant: getGuestAvatarVariant(identity.avatarVariant),
          isGuest: Boolean(identity.isGuest)
        }
      });
    });

    socket.on("room-users", async ({ self, participants, voiceParticipants, count, maxParticipants, roomName: joinedRoomName }) => {
      if (requestedAuthenticated && self?.isGuest) {
        setRoomError("A sessao da conta nao foi reconhecida nesta conexao.");
        setJoinState("error");
        cleanupRoom();
        return;
      }
      hasJoinedRef.current = true;
      setHasJoined(true);
      setJoinState("joined");
      if (self?.nickname) {
        setNickname(self.nickname);
      }
      if (self?.isGuest && Number.isInteger(self.avatarVariant)) {
        setGuestAvatarVariant(self.avatarVariant);
      }
      setParticipantCount(count);
      setMaxParticipants(maxParticipants || 10);
      setRoomName(joinedRoomName || `Sala ${roomCode}`);
      setRoomParticipants(participants);
      setIsInVoice(true);
      isInVoiceRef.current = true;
      upsertRemoteParticipants(voiceParticipants || participants);
      await setupLocalMedia();
      emitMediaStatus();
    });

    socket.on("room-roster", ({ participants: nextParticipants, voiceParticipants: nextVoiceParticipants, count, maxParticipants, roomName: joinedRoomName } = {}) => {
      const safeParticipants = Array.isArray(nextParticipants) ? nextParticipants : [];
      const safeVoiceParticipants = Array.isArray(nextVoiceParticipants) ? nextVoiceParticipants : [];

      setParticipantCount(Number.isInteger(count) ? count : safeParticipants.length);
      setMaxParticipants(maxParticipants || 10);
      setRoomName(joinedRoomName || `Sala ${roomCode}`);
      setRoomParticipants(safeParticipants.filter((participant) => participant.socketId !== socket.id));

      if (isInVoiceRef.current) {
        syncRemoteParticipants(safeVoiceParticipants.filter((participant) => participant.socketId !== socket.id));
      } else {
        setRemoteParticipants([]);
      }
    });

    socket.on("message-history", ({ channelId, messages: history } = {}) => {
      if (channelId === "general") {
        setMessages(Array.isArray(history) ? history : []);
      }
    });

    socket.on("message-created", (message) => {
      if (message.channelId !== "general") {
        return;
      }

      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    });

    socket.on("message-error", ({ message }) => {
      notify(message || "Nao foi possivel enviar a mensagem.");
    });

    socket.on("user-joined", async ({ participant, participants, voiceParticipants, count, maxParticipants, roomName: joinedRoomName }) => {
      setParticipantCount(count);
      setMaxParticipants(maxParticipants || 10);
      setRoomName(joinedRoomName || `Sala ${roomCode}`);
      setRoomParticipants(participants.filter((item) => item.socketId !== socket.id));
      if (isInVoiceRef.current) {
        upsertRemoteParticipants((voiceParticipants || [participant]).filter((item) => item.socketId !== socket.id));
        const peer = createPeer(participant.socketId, false, true);
        await sendOffer(participant.socketId, peer.pc);
        emitMediaStatus();
      }
    });

    socket.on("user-left", ({ participant, count, maxParticipants }) => {
      setParticipantCount(count);
      setMaxParticipants(maxParticipants || 10);
      removePeer(participant.socketId);
      setRoomParticipants((current) => current.filter((item) => item.socketId !== participant.socketId));
      setRemoteParticipants((current) =>
        current.filter((remote) => remote.socketId !== participant.socketId)
      );
    });

    socket.on("voice-users", async ({ participants }) => {
      setIsInVoice(true);
      upsertRemoteParticipants(participants);
      await setupLocalMedia();
      emitMediaStatus();
      participants.forEach((participant) => {
        const peer = createPeer(participant.socketId, false, true);
        sendOffer(participant.socketId, peer.pc);
      });
    });

    socket.on("voice-user-joined", async ({ participant }) => {
      if (!hasJoinedRef.current || !isInVoiceRef.current) {
        return;
      }

      upsertRemoteParticipants([participant]);
      createPeer(participant.socketId, false, false);
    });

    socket.on("voice-user-left", ({ participant }) => {
      removePeer(participant.socketId);
      setRemoteParticipants((current) => current.filter((item) => item.socketId !== participant.socketId));
    });

    socket.on("voice-left", () => {
      setIsInVoice(false);
      isInVoiceRef.current = false;
      closePeers();
      cleanupLocalMedia();
    });

    socket.on("webrtc-offer", async ({ from, offer }) => {
      console.log("[WEBRTC] offer received", from);
      await setupLocalMedia();
      const peer = createPeer(from, false, false);
      await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
      refreshPeerTransceivers(peer, true);
      syncLocalTracksToPeer(peer);
      await flushPendingIce(from);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { to: from, answer });
    });

    socket.on("webrtc-answer", async ({ from, answer }) => {
      console.log("[WEBRTC] answer received", from);
      const peer = peersRef.current.get(from);

      if (!peer) {
        return;
      }

      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushPendingIce(from);
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      console.log("[WEBRTC] ICE candidate received", from);
      await setupLocalMedia();
      const peer = peersRef.current.get(from) || createPeer(from, false, false);

      if (!peer.pc.remoteDescription) {
        const pending = pendingIceRef.current.get(from) || [];
        pending.push(candidate);
        pendingIceRef.current.set(from, pending);
        return;
      }

      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("screen-share-status", ({ from, isScreenSharing }) => {
      setRemoteParticipants((current) =>
        current.map((participant) =>
          participant.socketId === from ? { ...participant, isScreenSharing } : participant
        )
      );
    });

    socket.on("media-status", ({ from, micEnabled, cameraEnabled, isScreenSharing }) => {
      setRemoteParticipants((current) =>
        current.map((participant) =>
          participant.socketId === from
            ? { ...participant, micEnabled, cameraEnabled, isScreenSharing }
            : participant
        )
      );
    });

    socket.on("speaking-state", ({ from, isSpeaking: remoteSpeaking }) => {
      setRemoteParticipants((current) => current.map((participant) => (
        participant.socketId === from ? { ...participant, isSpeaking: Boolean(remoteSpeaking) } : participant
      )));
    });

    socket.on("nickname-updated", ({ participant, participants, voiceParticipants, count, maxParticipants }) => {
      setParticipantCount(count);
      setMaxParticipants(maxParticipants || 10);

      if (participant.socketId === socket.id) {
        setNickname(participant.nickname);
        if (!guestIdentity.isGuest) {
          localStorage.setItem(NICKNAME_KEY, participant.nickname);
        }
      }

      setRoomParticipants(participants.filter((item) => item.socketId !== socket.id));
      syncRemoteParticipants((voiceParticipants || participants).filter((item) => item.socketId !== socket.id));
    });

    socket.on("nickname-error", ({ message }) => {
      notify(message);
    });

    socket.on("room-error", ({ message }) => {
      setRoomError(message);
      notify(message);
      setJoinState("error");
      socket.disconnect();
      connectionStartedRef.current = false;
      cleanupLocalMedia();
    });

    socket.on("connect_error", () => {
      setRoomError(requestedAuthenticated
        ? "Nao foi possivel validar a sessao da conta. Recarregue a pagina e tente novamente."
        : "Erro de conexao. Verifique se o servidor esta rodando.");
      setJoinState("error");
      connectionStartedRef.current = false;
      socket.disconnect();
    });

    socket.on("disconnect", (reason) => {
      if (hasJoinedRef.current && reason !== "io client disconnect") {
        notify("Conexao com o servidor perdida.");
        setJoinState("disconnected");
        closePeers();
      }
    });
  }

  async function applyScreenSharePreset(track, preset = streamPreset) {
    if (!track?.applyConstraints) return false;
    try {
      await track.applyConstraints(getScreenShareConstraints(preset));
      setScreenShareSettings(track.getSettings?.() || null);
      return true;
    } catch {
      setScreenShareSettings(track.getSettings?.() || null);
      return false;
    }
  }

  async function changeStreamPreset(nextPreset) {
    const safePreset = STREAM_PRESETS[nextPreset] ? nextPreset : "720p30";
    setStreamPreset(safePreset);
    localStorage.setItem(STREAM_PRESET_KEY, safePreset);
    const activeScreenTrack = screenTrackRef.current;
    if (activeScreenTrack?.readyState === "live") {
      const applied = await applyScreenSharePreset(activeScreenTrack, safePreset);
      await configureScreenSenders(safePreset);
      notify(applied
        ? `${getStreamPresetLabel(safePreset)} aplicado.`
        : `O navegador manteve a melhor configuracao disponivel.`);
      return;
    }
  }

  async function setupLocalMedia() {
    if (localStreamRef.current) {
      return;
    }

    if (localMediaPromiseRef.current) {
      return localMediaPromiseRef.current;
    }

    localMediaPromiseRef.current = (async () => {
      const media = await requestInitialMedia(notify, {
        audioDeviceId: selectedAudioId,
        videoDeviceId: selectedVideoId
      });
      if (!isInVoiceRef.current || !hasJoinedRef.current) {
        stopStream(media.stream);
        return;
      }
      localStreamRef.current = media.stream;
      audioTrackRef.current = media.audioTrack;
      cameraTrackRef.current = media.videoTrack;
      setDisplayStream(media.videoTrack ? media.stream : null);
      updateMicEnabled(Boolean(media.audioTrack?.enabled), false);
      updateCameraEnabled(Boolean(media.videoTrack?.enabled), false);
      replaceSenderTrackForAll("audio", media.audioTrack);
      replaceSenderTrackForAll("video", media.videoTrack);
      startSpeakingDetection(media.audioTrack);
    })();

    try {
      await localMediaPromiseRef.current;
    } finally {
      localMediaPromiseRef.current = null;
    }
  }

  function createPeer(remoteSocketId, shouldCreateOffer, createOfferTransceivers = true) {
    const existingPeer = peersRef.current.get(remoteSocketId);

    if (existingPeer) {
      return existingPeer;
    }

    console.log("[WEBRTC] creating peer", remoteSocketId);
    const pc = new RTCPeerConnection(iceConfigRef.current);
    const peer = {
      pc,
      audioSender: null,
      videoSender: null
    };

    if (createOfferTransceivers) {
      pc.addTransceiver("audio", { direction: "sendrecv" });
      pc.addTransceiver("video", { direction: "sendrecv" });
    }

    peersRef.current.set(remoteSocketId, peer);
    refreshPeerTransceivers(peer, createOfferTransceivers);
    syncLocalTracksToPeer(peer);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (debugRtc) {
        console.debug("[RTC DEBUG] ontrack", {
          peer: remoteSocketId,
          kind: event.track.kind,
          id: event.track.id,
          readyState: event.track.readyState,
          streams: event.streams.map((stream) => stream.getTracks().map((track) => ({ kind: track.kind, id: track.id })))
        });
      }
      const stream = remoteStreamsRef.current.get(remoteSocketId) || new MediaStream();
      if (!stream.getTracks().some((track) => track.id === event.track.id)) {
        stream.addTrack(event.track);
      }
      remoteStreamsRef.current.set(remoteSocketId, stream);
      setRemoteParticipants((current) =>
        current.map((participant) =>
          participant.socketId === remoteSocketId ? { ...participant, stream } : participant
        )
      );
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        if (pc.connectionState === "failed") {
          removePeer(remoteSocketId);
        }
      }
    };

    if (shouldCreateOffer) {
      window.setTimeout(() => sendOffer(remoteSocketId, pc), 0);
    }

    return peer;
  }

  function refreshPeerTransceivers(peer, makeSendRecv = false) {
    const audioTransceiver = peer.pc.getTransceivers().find((transceiver) => (
      transceiver.receiver.track?.kind === "audio" || transceiver.sender.track?.kind === "audio"
    ));
    const videoTransceiver = peer.pc.getTransceivers().find((transceiver) => (
      transceiver.receiver.track?.kind === "video" || transceiver.sender.track?.kind === "video"
    ));

    if (makeSendRecv) {
      if (audioTransceiver) audioTransceiver.direction = "sendrecv";
      if (videoTransceiver) videoTransceiver.direction = "sendrecv";
    }

    peer.audioSender = audioTransceiver?.sender || null;
    peer.videoSender = videoTransceiver?.sender || null;
  }

  async function sendOffer(remoteSocketId, pc) {
    if (pc.signalingState !== "stable") {
      return;
    }

    const peer = peersRef.current.get(remoteSocketId);
    if (peer) {
      syncLocalTracksToPeer(peer);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit("webrtc-offer", { to: remoteSocketId, offer });
    console.log("[WEBRTC] offer sent", remoteSocketId);
  }

  async function flushPendingIce(remoteSocketId) {
    const peer = peersRef.current.get(remoteSocketId);
    const pending = pendingIceRef.current.get(remoteSocketId) || [];

    if (!peer || !peer.pc.remoteDescription) {
      return;
    }

    for (const candidate of pending) {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }

    pendingIceRef.current.delete(remoteSocketId);
  }

  function upsertRemoteParticipants(participants) {
    setRemoteParticipants((current) => {
      const next = new Map(current.map((participant) => [participant.socketId, participant]));

      participants.forEach((participant) => {
        next.set(participant.socketId, {
          ...next.get(participant.socketId),
          ...participant,
          stream: remoteStreamsRef.current.get(participant.socketId) || next.get(participant.socketId)?.stream || null,
          isScreenSharing: participant.isScreenSharing ?? next.get(participant.socketId)?.isScreenSharing ?? false,
          micEnabled: participant.micEnabled ?? next.get(participant.socketId)?.micEnabled ?? false,
          cameraEnabled: participant.cameraEnabled ?? next.get(participant.socketId)?.cameraEnabled ?? false,
          volume: next.get(participant.socketId)?.volume ?? 100
        });
      });

      return Array.from(next.values());
    });
  }

  function syncRemoteParticipants(participants) {
    setRemoteParticipants((current) => {
      const currentById = new Map(current.map((participant) => [participant.socketId, participant]));
      return participants.map((participant) => {
        const existing = currentById.get(participant.socketId);
        return {
          ...existing,
          ...participant,
          stream: remoteStreamsRef.current.get(participant.socketId) || existing?.stream || null,
          isScreenSharing: participant.isScreenSharing ?? existing?.isScreenSharing ?? false,
          micEnabled: participant.micEnabled ?? existing?.micEnabled ?? false,
          cameraEnabled: participant.cameraEnabled ?? existing?.cameraEnabled ?? false,
          volume: existing?.volume ?? 100
        };
      });
    });
  }

  function replaceSenderTrackForAll(kind, track) {
    peersRef.current.forEach((peer) => {
      const sender = kind === "audio" ? peer.audioSender : peer.videoSender;
      if (sender) {
        sender.replaceTrack(track?.readyState === "live" ? track : null);
      }
    });
  }

  function getScreenBitrate(preset, peerCount) {
    const baseBitrate = (STREAM_PRESETS[preset] || STREAM_PRESETS["720p30"]).maxBitrate;
    if (peerCount <= 1) return baseBitrate;
    if (peerCount === 2) return Math.min(baseBitrate, 4_500_000);
    if (peerCount === 3) return Math.min(baseBitrate, 3_500_000);
    return Math.min(baseBitrate, 2_500_000);
  }

  async function configureVideoSender(sender, mode, peerCount, preset = streamPreset) {
    if (!sender) {
      return;
    }

    const parameters = sender.getParameters?.();
    if (!parameters) {
      return;
    }

    if (!parameters.encodings?.length) {
      parameters.encodings = [{}];
    }

    const encoding = parameters.encodings[0];
    if (mode === "screen") {
      encoding.maxBitrate = getScreenBitrate(preset, peerCount);
      encoding.maxFramerate = (STREAM_PRESETS[preset] || STREAM_PRESETS["720p30"]).frameRate;
    } else {
      delete encoding.maxBitrate;
      delete encoding.maxFramerate;
    }

    await sender.setParameters(parameters).catch(() => {});
  }

  async function replaceVideoTrackForAllPeers(track, mode = "camera", preset = streamPreset) {
    const peers = Array.from(peersRef.current.values());
    await Promise.all(peers.map(async (peer) => {
      if (!peer.videoSender) {
        return;
      }
      await peer.videoSender.replaceTrack(track?.readyState === "live" ? track : null);
      await configureVideoSender(peer.videoSender, mode, peers.length, preset);
    }));
  }

  async function configureScreenSenders(preset = streamPreset) {
    const peers = Array.from(peersRef.current.values());
    await Promise.all(peers.map((peer) => configureVideoSender(peer.videoSender, "screen", peers.length, preset)));
  }

  function syncLocalTracksToPeer(peer) {
    if (!peer) {
      return;
    }

    const audioTrack = audioTrackRef.current?.readyState === "live" ? audioTrackRef.current : null;
    const videoTrack = (screenTrackRef.current || cameraTrackRef.current)?.readyState === "live"
      ? screenTrackRef.current || cameraTrackRef.current
      : null;

    peer.audioSender?.replaceTrack(audioTrack);
    if (peer.videoSender) {
      peer.videoSender.replaceTrack(videoTrack).then(() => {
        if (screenTrackRef.current) return configureVideoSender(peer.videoSender, "screen", peersRef.current.size, streamPreset);
        return undefined;
      }).catch(() => {});
    }
  }

  function summarizeSdp(sdp = "") {
    return ["audio", "video"].reduce((summary, kind) => {
      const section = sdp.split("m=").find((part) => part.startsWith(`${kind} `)) || "";
      summary[kind] = section.match(/a=(sendrecv|sendonly|recvonly|inactive)/)?.[1] || null;
      return summary;
    }, {});
  }

  async function collectPeerDiagnostics(peerSocketId, peer) {
    const { pc } = peer;
    const stats = { audio: { outbound: {}, inbound: {} }, video: { outbound: {}, inbound: {} } };
    const report = await pc.getStats().catch(() => null);

    report?.forEach((entry) => {
      if (entry.type !== "outbound-rtp" && entry.type !== "inbound-rtp") {
        return;
      }
      const kind = entry.kind || entry.mediaType;
      if (kind !== "audio" && kind !== "video") {
        return;
      }
      const direction = entry.type === "outbound-rtp" ? "outbound" : "inbound";
      const current = {
        packetsSent: entry.packetsSent,
        bytesSent: entry.bytesSent,
        packetsReceived: entry.packetsReceived,
        bytesReceived: entry.bytesReceived,
        framesEncoded: entry.framesEncoded,
        framesDecoded: entry.framesDecoded,
        framesPerSecond: entry.framesPerSecond,
        frameWidth: entry.frameWidth,
        frameHeight: entry.frameHeight,
        qualityLimitationReason: entry.qualityLimitationReason,
        qualityLimitationDurations: entry.qualityLimitationDurations,
        nackCount: entry.nackCount,
        pliCount: entry.pliCount,
        firCount: entry.firCount,
        packetsLost: entry.packetsLost,
        jitter: entry.jitter
      };
      const historyKey = `${peerSocketId}:${kind}:${direction}`;
      const previous = statsHistoryRef.current.get(historyKey);
      const now = performance.now();
      if (previous) {
        const elapsedSeconds = Math.max((now - previous.time) / 1000, 0.001);
        const bytesKey = direction === "outbound" ? "bytesSent" : "bytesReceived";
        const framesKey = direction === "outbound" ? "framesEncoded" : "framesDecoded";
        current.bitrateMbps = Math.max(0, (Number(current[bytesKey] || 0) - Number(previous.stats[bytesKey] || 0)) * 8 / elapsedSeconds / 1_000_000);
        current.calculatedFps = Math.max(0, (Number(current[framesKey] || 0) - Number(previous.stats[framesKey] || 0)) / elapsedSeconds);
      }
      statsHistoryRef.current.set(historyKey, { time: now, stats: current });
      stats[kind][direction] = current;
    });

    const candidatePair = Array.from(report?.values?.() || []).find((entry) => (
      entry.type === "candidate-pair" && entry.state === "succeeded" && (entry.nominated || entry.selected)
    ));

    const localTracks = [audioTrackRef.current, displayAudioTrackRef.current, cameraTrackRef.current, screenTrackRef.current]
      .filter(Boolean)
      .map((track) => ({ kind: track.kind, id: track.id, enabled: track.enabled, muted: track.muted, readyState: track.readyState }));
    const senders = pc.getSenders().map((sender) => ({
      kind: sender.track?.kind || null,
      id: sender.track?.id || null,
      enabled: sender.track?.enabled ?? null,
      readyState: sender.track?.readyState || null
    }));
    const receivers = pc.getReceivers().map((receiver) => ({
      kind: receiver.track?.kind || null,
      id: receiver.track?.id || null,
      readyState: receiver.track?.readyState || null
    }));
    const transceivers = pc.getTransceivers().map((transceiver) => ({
      mid: transceiver.mid,
      direction: transceiver.direction,
      currentDirection: transceiver.currentDirection,
      sender: transceiver.sender.track?.kind || null,
      receiver: transceiver.receiver.track?.kind || null
    }));
    const audioTransceivers = transceivers.filter((transceiver) => transceiver.sender === "audio" || transceiver.receiver === "audio");
    const videoTransceivers = transceivers.filter((transceiver) => transceiver.sender === "video" || transceiver.receiver === "video");
    const warnings = [];
    if (audioTransceivers.length > 1) warnings.push("DUPLICATE AUDIO TRANSCEIVER");
    if (videoTransceivers.length > 1) warnings.push("DUPLICATE VIDEO TRANSCEIVER");
    if (audioTransceivers.some((transceiver) => transceiver.currentDirection && transceiver.currentDirection !== "sendrecv")) warnings.push("AUDIO NOT SENDRECV");
    if (videoTransceivers.some((transceiver) => transceiver.currentDirection && transceiver.currentDirection !== "sendrecv")) warnings.push("VIDEO NOT SENDRECV");

    return {
      peerSocketId,
      signalingState: pc.signalingState,
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      iceGatheringState: pc.iceGatheringState,
      localTracks,
      senders,
      receivers,
      transceivers,
      warnings,
      sdp: {
        local: summarizeSdp(pc.localDescription?.sdp),
        remote: summarizeSdp(pc.remoteDescription?.sdp)
      },
      stats,
      network: candidatePair ? {
        currentRoundTripTime: candidatePair.currentRoundTripTime,
        availableOutgoingBitrate: candidatePair.availableOutgoingBitrate,
        availableIncomingBitrate: candidatePair.availableIncomingBitrate,
        bytesSent: candidatePair.bytesSent,
        bytesReceived: candidatePair.bytesReceived
      } : null,
      screenTrackSettings: screenTrackRef.current?.getSettings?.() || null,
      displayAudioAvailable: Boolean(displayAudioTrackRef.current),
      displayAudioTracks: displayAudioTrackRef.current ? [{
        id: displayAudioTrackRef.current.id,
        enabled: displayAudioTrackRef.current.enabled,
        readyState: displayAudioTrackRef.current.readyState
      }] : [],
      audioMode: displayAudioTrackRef.current ? "microphone+display" : "microphone",
      mixedAudioTrack: mixedAudioTrackRef.current ? {
        id: mixedAudioTrackRef.current.id,
        enabled: mixedAudioTrackRef.current.enabled,
        readyState: mixedAudioTrackRef.current.readyState
      } : null,
      audioElement: (() => {
        const audio = document.querySelector(`[data-audio-peer="${peerSocketId}"]`);
        return audio ? { hasSrcObject: Boolean(audio.srcObject), muted: audio.muted, volume: audio.volume, paused: audio.paused } : null;
      })(),
      videoElements: Array.from(document.querySelectorAll(`[data-video-peer="${peerSocketId}"]`)).map((video) => ({
        hasSrcObject: Boolean(video.srcObject), muted: video.muted, volume: video.volume, paused: video.paused, readyState: video.readyState
      })),
      remoteStreamTracks: remoteStreamsRef.current.get(peerSocketId)?.getTracks().map((track) => ({
        kind: track.kind,
        id: track.id,
        readyState: track.readyState,
        muted: track.muted
      })) || []
    };
  }

  async function toggleMicrophone() {
    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = !audioTrackRef.current.enabled;
      setMixedMicrophoneEnabled(audioTrackRef.current.enabled);
      updateMicEnabled(audioTrackRef.current.enabled);
      playUiSound(audioTrackRef.current.enabled ? "mic-unmute" : "mic-mute", uiSounds);
      return;
    }

    const result = await requestSingleKind("audio", selectedAudioId);
    if (!result.track) {
      notify("Permissao de microfone negada.");
      return;
    }

    audioTrackRef.current = result.track;
    localStreamRef.current?.addTrack(result.track);
    updateMicEnabled(true);
    if (displayAudioTrackRef.current) {
      createDisplayAudioMix(displayAudioTrackRef.current);
    } else {
      replaceSenderTrackForAll("audio", result.track);
    }
    startSpeakingDetection(result.track);
    playUiSound("mic-unmute", uiSounds);
  }

  async function toggleCamera() {
    if (cameraTrackRef.current) {
      cameraTrackRef.current.enabled = !cameraTrackRef.current.enabled;
      updateCameraEnabled(cameraTrackRef.current.enabled);

      if (!screenTrackRef.current) {
        setDisplayStream(cameraTrackRef.current.enabled ? localStreamRef.current : null);
      }

      return;
    }

    const result = await requestSingleKind("video", selectedVideoId);
    if (!result.track) {
      notify("Permissao de camera negada.");
      return;
    }

    cameraTrackRef.current = result.track;
    localStreamRef.current?.addTrack(result.track);
    updateCameraEnabled(true);

    if (!screenTrackRef.current) {
      setDisplayStream(localStreamRef.current);
      replaceSenderTrackForAll("video", result.track);
    }

  }

  async function toggleScreenShare() {
    if (screenTrackRef.current) {
      await stopScreenShare(true);
      return;
    }

    try {
      let screenStream;
      const screenConstraints = getScreenShareConstraints(streamPreset);
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: screenConstraints, audio: true });
      } catch (error) {
        if (!['TypeError', 'OverconstrainedError', 'NotSupportedError'].includes(error?.name)) {
          throw error;
        }
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      }
      const screenTrack = screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        throw new Error("Screen track unavailable");
      }

      screenTrack.contentHint = "motion";
      await applyScreenSharePreset(screenTrack, streamPreset);

      screenStreamRef.current = screenStream;
      screenTrackRef.current = screenTrack;
      displayAudioTrackRef.current = screenStream.getAudioTracks()[0] || null;
      screenTrack.onended = () => { void stopScreenShare(false); };

      if (displayAudioTrackRef.current) {
        createDisplayAudioMix(displayAudioTrackRef.current);
      }

      await replaceVideoTrackForAllPeers(screenTrack, "screen", streamPreset);
      setDisplayStream(screenStream);
      updateScreenSharing(true);
      socketRef.current?.emit("screen-share-status", { isScreenSharing: true });
      playUiSound("screen-start", uiSounds);
      console.log("[SCREEN] share started");
    } catch {
      // Cancelamentos do seletor de tela sao uma acao local, sem toast.
    }
  }

  function createDisplayAudioMix(displayAudioTrack) {
    teardownDisplayAudioMix();

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    try {
      const context = new AudioContextClass();
      const destination = context.createMediaStreamDestination();
      const displaySource = context.createMediaStreamSource(new MediaStream([displayAudioTrack]));
      const displayGain = context.createGain();
      displayGain.gain.value = 1;
      displaySource.connect(displayGain).connect(destination);

      const microphoneTrack = audioTrackRef.current;
      if (microphoneTrack?.readyState === "live") {
        const microphoneSource = context.createMediaStreamSource(new MediaStream([microphoneTrack]));
        const microphoneGain = context.createGain();
        microphoneGain.gain.value = microphoneTrack.enabled ? 1 : 0;
        microphoneSource.connect(microphoneGain).connect(destination);
        microphoneGainRef.current = microphoneGain;
      }

      audioMixContextRef.current = context;
      mixedAudioTrackRef.current = destination.stream.getAudioTracks()[0] || null;
      replaceSenderTrackForAll("audio", mixedAudioTrackRef.current);
      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }
    } catch {
      teardownDisplayAudioMix();
    }
  }

  function teardownDisplayAudioMix() {
    microphoneGainRef.current = null;
    audioMixContextRef.current?.close?.().catch(() => {});
    audioMixContextRef.current = null;
    mixedAudioTrackRef.current?.stop();
    mixedAudioTrackRef.current = null;
  }

  function setMixedMicrophoneEnabled(enabled) {
    if (microphoneGainRef.current) {
      microphoneGainRef.current.gain.value = enabled ? 1 : 0;
    }
  }

  async function stopScreenShare(stopTracks) {
    if (!screenTrackRef.current) {
      return;
    }

    stopStream(screenStreamRef.current);

    teardownDisplayAudioMix();
    displayAudioTrackRef.current = null;
    screenTrackRef.current = null;
    screenStreamRef.current = null;
    setScreenShareSettings(null);

    const cameraTrack = cameraTrackRef.current;
    const shouldRestoreCamera = Boolean(cameraTrack && cameraTrack.readyState === "live" && cameraTrack.enabled);
    await replaceVideoTrackForAllPeers(shouldRestoreCamera ? cameraTrack : null, "camera");
    replaceSenderTrackForAll("audio", audioTrackRef.current);
    setDisplayStream(shouldRestoreCamera ? localStreamRef.current : null);
    updateScreenSharing(false);
    socketRef.current?.emit("screen-share-status", { isScreenSharing: false });
    playUiSound("screen-stop", uiSounds);
    console.log("[SCREEN] share stopped");
  }

  function removePeer(remoteSocketId) {
    const peer = peersRef.current.get(remoteSocketId);
    peer?.pc.close();
    peersRef.current.delete(remoteSocketId);
    pendingIceRef.current.delete(remoteSocketId);
    remoteStreamsRef.current.get(remoteSocketId)?.getTracks().forEach((track) => track.stop());
    remoteStreamsRef.current.delete(remoteSocketId);
  }

  function closePeers() {
    Array.from(peersRef.current.keys()).forEach(removePeer);
    setRemoteParticipants([]);
  }

  function cleanupLocalMedia() {
    stopSpeakingDetection();
    teardownDisplayAudioMix();
    displayAudioTrackRef.current = null;
    stopStream(screenStreamRef.current);
    stopStream(localStreamRef.current);
    screenStreamRef.current = null;
    screenTrackRef.current = null;
    setScreenShareSettings(null);
    localStreamRef.current = null;
    audioTrackRef.current = null;
    cameraTrackRef.current = null;
    setDisplayStream(null);
    updateMicEnabled(false, false);
    updateCameraEnabled(false, false);
    updateScreenSharing(false, false);
  }

  function cleanupRoom() {
    socketRef.current?.emit("leave-room");
    closePeers();
    cleanupLocalMedia();
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocketInstance(null);
    hasJoinedRef.current = false;
    connectionStartedRef.current = false;
  }

  function leaveRoom() {
    cleanupRoom();
    onBack();
  }

  function requestLeaveRoom() {
    if (confirmLeaveRoom) {
      setIsLeaveConfirmOpen(true);
      return;
    }
    leaveRoom();
  }

  function toggleDeafen() {
    setIsDeafened((current) => !current);
  }

  function leaveVoiceChannel() {
    if (!isInVoiceRef.current) {
      return;
    }

    socketRef.current?.emit("leave-voice");
    isInVoiceRef.current = false;
    setIsInVoice(false);
    closePeers();
    cleanupLocalMedia();
    playUiSound("voice-leave", uiSounds);
  }

  function joinVoiceChannel() {
    if (isInVoiceRef.current || !socketRef.current) {
      return;
    }

    isInVoiceRef.current = true;
    setIsInVoice(true);
    socketRef.current.emit("join-voice");
    playUiSound("voice-join", uiSounds);
  }

  async function openDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      notify("Seu navegador nao permite selecionar dispositivos.");
      return;
    }

    try {
      const listedDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audio: listedDevices.filter((device) => device.kind === "audioinput"),
        output: listedDevices.filter((device) => device.kind === "audiooutput"),
        video: listedDevices.filter((device) => device.kind === "videoinput")
      });
      setIsDevicesModalOpen(true);
    } catch {
      notify("Nao foi possivel listar os dispositivos.");
    }
  }

  async function saveDevices({ audioId, outputId, videoId }) {
    setSelectedAudioId(audioId);
    setSelectedOutputId(outputId);
    setSelectedVideoId(videoId);
    localStorage.setItem(AUDIO_DEVICE_KEY, audioId);
    localStorage.setItem(OUTPUT_DEVICE_KEY, outputId);
    localStorage.setItem(VIDEO_DEVICE_KEY, videoId);
    setIsDevicesModalOpen(false);

    if (!isInVoiceRef.current) {
      return;
    }

    if (audioId !== selectedAudioId) {
      const result = await requestSingleKind("audio", audioId);
      if (result.track) {
        const previousTrack = audioTrackRef.current;
        result.track.enabled = previousTrack?.enabled ?? true;
        if (previousTrack) {
          localStreamRef.current?.removeTrack(previousTrack);
        }
        previousTrack?.stop();
        localStreamRef.current?.addTrack(result.track);
        audioTrackRef.current = result.track;
        if (displayAudioTrackRef.current) {
          createDisplayAudioMix(displayAudioTrackRef.current);
        } else {
          replaceSenderTrackForAll("audio", result.track);
        }
        updateMicEnabled(result.track.enabled);
        startSpeakingDetection(result.track);
      } else {
        notify("Nao foi possivel trocar o microfone.");
      }
    }

    if (videoId !== selectedVideoId) {
      const result = await requestSingleKind("video", videoId);
      if (result.track) {
        const previousTrack = cameraTrackRef.current;
        result.track.enabled = previousTrack?.enabled ?? true;
        if (previousTrack) {
          localStreamRef.current?.removeTrack(previousTrack);
        }
        previousTrack?.stop();
        localStreamRef.current?.addTrack(result.track);
        cameraTrackRef.current = result.track;
        if (!screenTrackRef.current) {
          replaceSenderTrackForAll("video", result.track);
          setDisplayStream(result.track.enabled ? localStreamRef.current : null);
        }
        updateCameraEnabled(result.track.enabled);
      } else {
        notify("Nao foi possivel trocar a camera.");
      }
    }

  }

  function saveProfile(nextProfile) {
    const next = { ...profile, ...nextProfile };
    setProfile(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    if (next.avatarUrl) { localStorage.setItem(AVATAR_KEY, next.avatarUrl); setAvatarUrl(next.avatarUrl); } else { localStorage.removeItem(AVATAR_KEY); setAvatarUrl(""); }
    if (accountUser && next.displayName && next.displayName !== accountUser.displayName) {
      updateAccountProfile({ displayName: next.displayName }).catch((error) => notify(error.message));
    }
    notify("Perfil salvo.");
  }

  async function logoutAccount() {
    await logout();
    setIsProfilePopoverOpen(false);
    notify("Sessao encerrada. A sala continua conectada.");
  }

  function recentRooms() {
    try { return JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || "[]").slice(0, 10); } catch { return []; }
  }

  function switchRoom(nextCode) {
    cleanupRoom();
    onNavigateRoom?.(nextCode);
  }

  function openProfilePopover() { setIsSettingsOpen(false); setIsProfilePopoverOpen(true); }
  function openParticipantProfile(participant, anchorRect) {
    setIsProfilePopoverOpen(false);
    setSelectedParticipantProfile({ participant, anchorRect });
  }
  function handleSelectChannel(channel) {
    setSelectedChannel(channel);
    setActiveContentView(channel === "voice-general" ? "media" : "text");
  }
  function handleToggleScreenShare() {
    setActiveContentView("media");
    return toggleScreenShare();
  }
  function openProfileSettings() { setIsProfilePopoverOpen(false); setSettingsInitialSection("profile"); setIsSettingsOpen(true); }
  function openSettings() { setIsProfilePopoverOpen(false); setSettingsInitialSection("profile"); setIsSettingsOpen(true); }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyFallbackLink("");
      notify("Convite copiado.");
    } catch {
      setCopyFallbackLink(inviteLink);
      notify("Nao foi possivel copiar automaticamente.");
    }
  }

  function emitMediaStatus() {
    socketRef.current?.emit("media-status", {
      micEnabled: micEnabledRef.current,
      cameraEnabled: cameraEnabledRef.current,
      isScreenSharing: screenSharingRef.current
    });
  }

  function updateSpeakingState(value) {
    if (speakingRef.current === value) {
      return;
    }

    speakingRef.current = value;
    setIsSpeaking(value);
    socketRef.current?.emit("speaking-state", { isSpeaking: value });
  }

  function stopSpeakingDetection() {
    if (speechFrameRef.current) {
      cancelAnimationFrame(speechFrameRef.current);
      speechFrameRef.current = null;
    }

    speechSourceRef.current?.disconnect();
    analyserRef.current?.disconnect?.();
    audioContextRef.current?.close?.().catch(() => {});
    speechSourceRef.current = null;
    analyserRef.current = null;
    audioContextRef.current = null;
    updateSpeakingState(false);
  }

  function startSpeakingDetection(track) {
    stopSpeakingDetection();

    if (!track || typeof window === "undefined") {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    try {
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      const source = context.createMediaStreamSource(new MediaStream([track]));
      const data = new Uint8Array(analyser.fftSize);
      analyser.fftSize = 512;
      source.connect(analyser);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      speechSourceRef.current = source;

      const detect = () => {
        if (!audioContextRef.current || track.readyState !== "live") {
          return;
        }

        analyser.getByteTimeDomainData(data);
        let total = 0;
        for (const value of data) {
          total += Math.abs(value - 128);
        }

        const active = track.enabled && total / data.length > 7;
        updateSpeakingState(active);
        speechFrameRef.current = requestAnimationFrame(detect);
      };

      detect();
    } catch {
      stopSpeakingDetection();
    }
  }

  function updateMicEnabled(value, shouldEmit = true) {
    micEnabledRef.current = value;
    setMicEnabled(value);
    if (!value) {
      updateSpeakingState(false);
    }
    if (shouldEmit) {
      emitMediaStatus();
    }
  }

  function updateCameraEnabled(value, shouldEmit = true) {
    cameraEnabledRef.current = value;
    setCameraEnabled(value);
    if (shouldEmit) {
      emitMediaStatus();
    }
  }

  function updateScreenSharing(value, shouldEmit = true) {
    screenSharingRef.current = value;
    setIsScreenSharing(value);
    if (shouldEmit) {
      emitMediaStatus();
    }
  }

  function changeRemoteVolume(socketId, volume) {
    setRemoteParticipants((current) =>
      current.map((participant) =>
        participant.socketId === socketId ? { ...participant, volume } : participant
      )
    );
  }

  if (authStatus === "loading" || !nickname || (!hasJoined && joinState === "idle")) {
    return (
      <main className="page home-page">
        <ToastStack toasts={toasts} />
        <section className="home-panel">
          <p className="eyebrow">EchoLive</p>
          <h1>Preparando sua entrada...</h1>
          <p className="home-subtitle">Sua identidade temporaria sera criada automaticamente.</p>
          <button className="ghost-button" type="button" onClick={onBack}>
            Voltar
          </button>
        </section>
      </main>
    );
  }

  if (roomError) {
    return (
      <main className="page home-page">
        <ToastStack toasts={toasts} />
        <section className="home-panel">
          <h1>EchoLive</h1>
          <p className="error-message">{roomError}</p>
          <button className="primary-button" type="button" onClick={onBack}>
            Voltar
          </button>
        </section>
      </main>
    );
  }

  const isGuest = !accountUser;
  const localDisplayName = accountUser?.displayName || accountUser?.username || nickname || guestIdentity.nickname;
  const localAvatarUrl = isGuest ? "" : avatarUrl || accountUser?.avatarUrl || "";
  const localAvatarVariant = isGuest ? guestAvatarVariant : 0;
  const localParticipant = {
    socketId: selfId || "local",
    nickname: localDisplayName,
    displayName: localDisplayName,
    username: accountUser?.username || "",
    avatarUrl: localAvatarUrl,
    avatarVariant: localAvatarVariant,
    badges: accountUser?.badges || [],
    isGuest,
    stream: displayStream,
    isLocal: true,
    isScreenSharing,
    isSpeaking,
    micEnabled,
    cameraEnabled,
    status: isGuest ? "online" : profile.status
  };
  const onlineParticipants = [localParticipant, ...roomParticipants];
  const voiceParticipants = isInVoice ? [localParticipant, ...remoteParticipants] : [];
  const currentParticipantCount = Math.max(participantCount, onlineParticipants.length);
  const connectionQuality = !isInVoice ? "Offline" : rtcDiagnostics.some((diagnostic) => diagnostic.connectionState === "failed" || diagnostic.warnings.length) ? "Instavel" : "Boa";
  const callParticipants = voiceParticipants.filter(
    (participant) => participant.isScreenSharing || (participant.cameraEnabled && participant.stream)
  ).sort(
    (left, right) => Number(right.isScreenSharing) - Number(left.isScreenSharing)
  );
  const focusedParticipant = callParticipants.find((participant) => participant.socketId === focusedMediaId) || callParticipants[0];
  const screenShareLabel = getActualScreenLabel(screenShareSettings, streamPreset);

  function renderParticipantCard(participant, compact = false) {
    return (
      <ParticipantCard
        key={`${compact ? "thumb" : "main"}-${participant.socketId}`}
        {...participant}
        screenShareLabel={participant.isLocal ? screenShareLabel : ""}
        compact={compact}
        isDeafened={isDeafened}
        notify={notify}
        outputDeviceId={selectedOutputId}
        onFocus={(socketId) => {
          setFocusedMediaId(socketId);
          setViewMode("focus");
        }}
        onVolumeChange={(volume) => changeRemoteVolume(participant.socketId, volume)}
      />
    );
  }

  return (
    <main className="page room-page app-shell">
      <ToastStack toasts={toasts} />
      {debugRtc && (
        <aside className="rtc-debug-panel" aria-label="Diagnostico WebRTC">
          <strong>RTC DEBUG</strong>
          <span>Peers: {rtcDiagnostics.length} | IDs: {Array.from(peersRef.current.keys()).join(", ") || "nenhum"}</span>
          {rtcDiagnostics.map((diagnostic) => (
            <details key={diagnostic.peerSocketId} open>
              <summary>Peer {diagnostic.peerSocketId} | {diagnostic.connectionState} / {diagnostic.iceConnectionState}{diagnostic.warnings.length ? ` | ${diagnostic.warnings.join(", ")}` : ""}</summary>
              <pre>{JSON.stringify(diagnostic, null, 2)}</pre>
            </details>
          ))}
        </aside>
      )}
      <div className="audio-sinks" aria-hidden="true">
        {voiceParticipants.filter((participant) => !participant.isLocal && !callParticipants.some((visual) => visual.socketId === participant.socketId)).map((participant) => (
          <AudioParticipant key={participant.socketId} peerSocketId={participant.socketId} stream={participant.stream} volume={participant.volume} isDeafened={isDeafened} outputDeviceId={selectedOutputId} />
        ))}
      </div>
      <RoomRail roomCode={roomCode} roomName={roomName} recentRooms={recentRooms()} onHome={onBack} onSocial={onNavigateSocial} onOpenSwitcher={() => setIsRoomSwitcherOpen(true)} />
      <Sidebar
        roomCode={roomCode}
        roomName={roomName}
        participantCount={currentParticipantCount}
        maxParticipants={maxParticipants}
        participants={voiceParticipants}
        selectedChannel={selectedChannel}
        onSelectChannel={handleSelectChannel}
        onCopyInvite={copyInvite}
        notify={notify}
        copyFallbackLink={copyFallbackLink}
        nickname={localDisplayName}
        isGuest={isGuest}
        avatarVariant={localAvatarVariant}
        status={isGuest ? "online" : profile.status}
        customStatus={isGuest ? "" : profile.customStatus}
        isInVoice={isInVoice}
        connectionQuality={connectionQuality}
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        isScreenSharing={isScreenSharing}
        streamPreset={streamPreset}
        screenShareLabel={screenShareLabel}
        isDeafened={isDeafened}
        isSpeaking={isSpeaking}
        avatarUrl={localAvatarUrl}
        onProfileClick={openProfilePopover}
        onToggleMicrophone={toggleMicrophone}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onStreamPresetChange={changeStreamPreset}
        onToggleDeafen={toggleDeafen}
        onLeaveVoice={leaveVoiceChannel}
        onJoinVoice={joinVoiceChannel}
        onLeaveRoom={requestLeaveRoom}
      />

      <section className="central-stage">
        {activeContentView === "media" ? <section className="call-stage channel-view">
        <header className="room-header">
          <div>
            <p className="eyebrow">Voz</p>
            <p className="call-context-line">Geral</p>
          </div>
          <div className="room-meta">
            <span>Participantes: {currentParticipantCount}/{maxParticipants}</span>
            <div className="call-view-controls" aria-label="Modo de visualizacao">
              <button type="button" className={viewMode === "grid" ? "is-selected" : ""} onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"}>Grade</button>
              <button type="button" className={viewMode === "focus" ? "is-selected" : ""} onClick={() => { setViewMode("focus"); setFocusedMediaId((current) => current || callParticipants[0]?.socketId || ""); }} aria-pressed={viewMode === "focus"} disabled={!callParticipants.length}>Foco</button>
            </div>
          </div>
        </header>

        {joinState === "joining" && <p className="status-line">Entrando na sala...</p>}
        {joinState === "disconnected" && (
          <p className="status-line danger">Conexao com o servidor perdida.</p>
        )}

        {!isInVoice ? (
          <section className="voice-empty-surface" aria-label="Canal de voz vazio" />
        ) : callParticipants.length > 0 ? (
          viewMode === "focus" && focusedParticipant ? (
            <section className="focus-layout">
              <div className="focus-main">{renderParticipantCard(focusedParticipant)}</div>
              <div className="focus-thumbnails">
                {callParticipants.filter((participant) => participant.socketId !== focusedParticipant.socketId).map((participant) => renderParticipantCard(participant, true))}
              </div>
            </section>
          ) : (
            <section className={`participants-grid count-${callParticipants.length} ${callParticipants.some((participant) => participant.isScreenSharing) ? "has-sharing" : ""}`}>
              {callParticipants.map((participant) => renderParticipantCard(participant))}
            </section>
          )
        ) : (
          <section className="voice-empty-surface" aria-label="Canal de voz vazio" />
        )}

        </section> : <section className="chat-stage channel-view">
          {isScreenSharing && <button type="button" className="active-media-view-banner" onClick={() => setActiveContentView("media")}><Icon name="screenShare" size={15} /><span>Transmissao ativa</span><strong>Ver transmissao</strong></button>}
          <ChatPanel
              socket={socketInstance}
              socketId={selfId}
              roomCode={roomCode}
              messages={messages}
              notify={notify}
              uiSounds={uiSounds}
              displayName={localDisplayName}
              isReady={hasJoined}
            />
        </section>}
      </section>

      <ParticipantsPanel participants={onlineParticipants} onProfileClick={openProfilePopover} onParticipantClick={openParticipantProfile} />

      {isProfilePopoverOpen && <ProfilePopover accountUser={accountUser} profile={profile} nickname={nickname} avatarUrl={localAvatarUrl} isGuest={isGuest} guestAvatarVariant={localAvatarVariant} onStatusChange={(status) => saveProfile({ status })} onEditProfile={openProfileSettings} onOpenSettings={openSettings} onLogout={logoutAccount} onCreateAccount={() => { setIsProfilePopoverOpen(false); setAuthModalMode("register"); }} onClose={() => setIsProfilePopoverOpen(false)} />}
      {selectedParticipantProfile && <SocialUserProfilePopover participant={selectedParticipantProfile.participant} anchorRect={selectedParticipantProfile.anchorRect} onClose={() => setSelectedParticipantProfile(null)} onMessage={() => { setSelectedParticipantProfile(null); onNavigateSocial?.(); }} onViewProfile={() => { setSelectedParticipantProfile(null); notify("O perfil completo estara disponivel em uma proxima etapa."); }} />}
      {isDevicesModalOpen && (
        <DevicesModal
          devices={devices}
          selectedAudioId={selectedAudioId}
          selectedOutputId={selectedOutputId}
          selectedVideoId={selectedVideoId}
          onClose={() => setIsDevicesModalOpen(false)}
          onSave={saveDevices}
        />
      )}
      {isSettingsOpen && (
        <SettingsModal
          initialSection={settingsInitialSection}
          theme={theme}
          onThemeChange={setTheme}
          accentColor={accentColor}
          onAccentChange={setAccentColor}
          uiSounds={uiSounds}
          onUiSoundsChange={setUiSounds}
          confirmLeaveRoom={confirmLeaveRoom}
          onConfirmLeaveChange={setConfirmLeaveRoom}
          onOpenDevices={() => { setIsSettingsOpen(false); openDevices(); }}
          streamPreset={streamPreset}
          onStreamPresetChange={changeStreamPreset}
          profile={{ ...profile, displayName: accountUser?.displayName || profile.displayName, username: accountUser?.username || "", avatarUrl }}
          onProfileChange={saveProfile}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
      {isRoomSwitcherOpen && <RoomSwitcherModal key={recentRoomsRevision} currentRoomCode={roomCode} recentRooms={recentRooms()} onEnter={switchRoom} onRemove={(code) => { const next = recentRooms().filter((room) => room.code !== code); localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(next)); setRecentRoomsRevision((value) => value + 1); }} onClear={() => { localStorage.removeItem(RECENT_ROOMS_KEY); setRecentRoomsRevision((value) => value + 1); }} onClose={() => setIsRoomSwitcherOpen(false)} />}
      {isLeaveConfirmOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="leave-title">
            <p className="section-label">Sala</p>
            <h2 id="leave-title">Sair desta sala?</h2>
            <p>Voce sera desconectado da voz e do chat desta sala.</p>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setIsLeaveConfirmOpen(false)}>Cancelar</button>
              <button type="button" className="danger-button" onClick={() => { setIsLeaveConfirmOpen(false); leaveRoom(); }}>Sair</button>
            </div>
          </section>
        </div>
      )}
      <AuthModal open={Boolean(authModalMode)} initialMode={authModalMode || "register"} onClose={() => setAuthModalMode(null)} />
    </main>
  );
}
