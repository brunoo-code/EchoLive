import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import ChatPanel from "../components/ChatPanel.jsx";
import AudioParticipant from "../components/AudioParticipant.jsx";
import AuthModal from "../components/AuthModal.jsx";
import DevicesModal from "../components/DevicesModal.jsx";
import SettingsModal from "../components/SettingsModal.jsx";
import CallMediaView, { MediaPip } from "../components/CallMediaView.jsx";
import ParticipantsPanel from "../components/ParticipantsPanel.jsx";
import Sidebar from "../components/Sidebar.jsx";
import RoomSwitcherModal from "../components/RoomSwitcherModal.jsx";
import RoomRail from "../components/RoomRail.jsx";
import ProfilePopover from "../components/ProfilePopover.jsx";
import SocialUserProfilePopover from "../components/SocialUserProfilePopover.jsx";
import SocialUserProfileModal from "../components/SocialUserProfileModal.jsx";
import Icon from "../components/Icon.jsx";
import ToastStack from "../components/ToastStack.jsx";
import useToasts from "../hooks/useToasts.js";
import { createMixedAudioTrack, requestInitialMedia, requestScreenShareStream, requestSingleKind, stopStream } from "../utils/media.js";
import { getPeerConnectionConfig, SERVER_URL } from "../utils/webrtc.js";
import { createVoiceCallEngine } from "../utils/voiceCallEngine.js";
import { playUiSound } from "../utils/uiSounds.js";
import { getGuestAvatarVariant, getGuestIdentity } from "../utils/guestIdentity.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useSocial } from "../social/SocialContext.jsx";

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

function formatRoomRemaining(expiresAt, now = Date.now()) {
  const remainingMs = Number(expiresAt) - now;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "";

  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h${minutes ? ` ${minutes}min` : ""} restantes`;
  }

  return `${totalMinutes}min restantes`;
}

export default function RoomPage({ roomCode, onBack, onNavigateRoom, onNavigateSocial, onNavigateDm, onNavigateServer }) {
  const { logout, updateProfile: updateAccountProfile, status: authStatus, user: accountUser } = useAuth();
  const { startConversation } = useSocial();
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
  const [isInVoice, setIsInVoice] = useState(false);
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
  const [roomExpiresAt, setRoomExpiresAt] = useState(null);
  const [roomExpiryNow, setRoomExpiryNow] = useState(Date.now());
  const [roomExpiryWarning, setRoomExpiryWarning] = useState("");
  const [isRoomExpired, setIsRoomExpired] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState("text-general");
  const [activeContentView, setActiveContentView] = useState("text");
  const [isPipDismissed, setIsPipDismissed] = useState(false);
  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(false);
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
  const [selectedSocialProfile, setSelectedSocialProfile] = useState(null);
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
      return { ...nextProfile, status: ["online", "dnd", "invisible"].includes(nextProfile.status) ? nextProfile.status : "online" };
    } catch {
      return { displayName: "", nickname: "", status: "online", customStatus: "", avatarUrl: "" };
    }
  });
  const { toasts, notify } = useToasts();

  const socketRef = useRef(null);
  const voiceEngineRef = useRef(null);
  const voiceEngineDetachRef = useRef(null);
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
  const isInVoiceRef = useRef(false);
  const statsHistoryRef = useRef(new Map());
  const roomExpiryWarningsRef = useRef(new Set());

  useEffect(() => {
    if (!accountUser) return;
    const accountProfile = {
      displayName: accountUser.displayName || accountUser.username || "",
      nickname: accountUser.displayName || accountUser.username || "",
      status: accountUser.status || "online",
      customStatus: accountUser.customStatus || "",
      avatarUrl: accountUser.avatarUrl || "",
      pronouns: accountUser.pronouns || "",
      aboutMe: accountUser.aboutMe || "",
      accentColor: accountUser.accentColor || "#22D3EE",
      badges: accountUser.badges || []
    };
    setProfile(accountProfile);
    setAvatarUrl(accountProfile.avatarUrl);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(accountProfile));
    if (accountProfile.avatarUrl) localStorage.setItem(AVATAR_KEY, accountProfile.avatarUrl);
    else localStorage.removeItem(AVATAR_KEY);
  }, [accountUser]);

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
    roomExpiryWarningsRef.current.clear();
    setRoomExpiresAt(null);
    setRoomExpiryNow(Date.now());
    setRoomExpiryWarning("");
    setIsRoomExpired(false);
  }, [roomCode]);

  useEffect(() => {
    if (!roomExpiresAt) return undefined;

    function updateRoomExpiry() {
      const remainingMs = Number(roomExpiresAt) - Date.now();
      const now = Date.now();
      setRoomExpiryNow(now);

      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        return;
      }

      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      const warning = remainingMs <= 5 * 60 * 1000
        ? { key: "5", label: `${remainingMinutes} minuto${remainingMinutes === 1 ? "" : "s"}` }
        : remainingMs <= 15 * 60 * 1000
          ? { key: "15", label: `${remainingMinutes} minuto${remainingMinutes === 1 ? "" : "s"}` }
          : null;

      if (warning && !roomExpiryWarningsRef.current.has(warning.key)) {
        roomExpiryWarningsRef.current.add(warning.key);
        const message = `Sala expira em ${warning.label}.`;
        setRoomExpiryWarning(message);
        notify(message);
      }
    }

    updateRoomExpiry();
    const timer = window.setInterval(updateRoomExpiry, 60000);
    return () => window.clearInterval(timer);
  }, [notify, roomExpiresAt]);

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
            userId: accountUser.id,
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
  }, [accountUser?.id, authStatus, guestIdentity]);

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
    setIsRoomExpired(false);
    setJoinState("joining");
    iceConfigRef.current = await getPeerConnectionConfig();

    if (lifecycleTokenRef.current !== lifecycleToken) {
      connectionStartedRef.current = false;
      return;
    }

    const socket = io(SERVER_URL, { withCredentials: true });
    socketRef.current = socket;
    setSocketInstance(socket);
    voiceEngineRef.current = createVoiceCallEngine({
      socket,
      peerStore: peersRef.current,
      pendingIceStore: pendingIceRef.current,
      remoteStreamsStore: remoteStreamsRef.current,
      getIceConfig: () => iceConfigRef.current,
      getLocalTracks: () => ({
        audio: mixedAudioTrackRef.current || audioTrackRef.current,
        video: screenTrackRef.current || cameraTrackRef.current
      }),
      debug: debugRtc,
      onRemoteStream: (remoteSocketId, stream) => {
        setRemoteParticipants((current) => current.map((participant) => (
          participant.socketId === remoteSocketId ? { ...participant, stream } : participant
        )));
      }
    });
    voiceEngineDetachRef.current = voiceEngineRef.current.attachSignaling({ prepareLocalMedia: setupLocalMedia });

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
          userId: identity.userId || accountUser?.id || "",
          displayName: identity.displayName || cleanNickname,
          username: identity.username || "",
          avatarUrl: identity.isGuest ? "" : identity.avatarUrl || "",
          avatarVariant: getGuestAvatarVariant(identity.avatarVariant),
          isGuest: Boolean(identity.isGuest)
        }
      });
    });

    socket.on("room-users", async ({ self, participants, voiceParticipants, count, maxParticipants, roomName: joinedRoomName, expiresAt }) => {
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
      setRoomExpiresAt(expiresAt || null);
      setRoomParticipants(participants);
      setIsInVoice(false);
      isInVoiceRef.current = false;
      setRemoteParticipants([]);
    });

    socket.on("room-roster", ({ participants: nextParticipants, voiceParticipants: nextVoiceParticipants, count, maxParticipants, roomName: joinedRoomName, expiresAt } = {}) => {
      const safeParticipants = Array.isArray(nextParticipants) ? nextParticipants : [];
      const safeVoiceParticipants = Array.isArray(nextVoiceParticipants) ? nextVoiceParticipants : [];

      setParticipantCount(Number.isInteger(count) ? count : safeParticipants.length);
      setMaxParticipants(maxParticipants || 10);
      setRoomName(joinedRoomName || `Sala ${roomCode}`);
      if (expiresAt) setRoomExpiresAt(expiresAt);
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

    socket.on("user-joined", async ({ participant, participants, voiceParticipants, count, maxParticipants, roomName: joinedRoomName, expiresAt }) => {
      setParticipantCount(count);
      setMaxParticipants(maxParticipants || 10);
      setRoomName(joinedRoomName || `Sala ${roomCode}`);
      if (expiresAt) setRoomExpiresAt(expiresAt);
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
      isInVoiceRef.current = true;
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
      setIsRoomExpired(String(message || "").toLowerCase().includes("expir"));
      notify(message);
      setJoinState("error");
      socket.disconnect();
      connectionStartedRef.current = false;
      cleanupLocalMedia();
    });

    socket.on("room-expired", ({ message, detail } = {}) => {
      setRoomError([message || "Esta Sala Rápida expirou.", detail].filter(Boolean).join(" "));
      setIsRoomExpired(true);
      setHasJoined(false);
      setJoinState("error");
      setIsInVoice(false);
      isInVoiceRef.current = false;
      setRoomExpiresAt(null);
      setRoomExpiryWarning("");
      notify(message || "Esta Sala Rápida expirou.");
      cleanupRoom();
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
    return voiceEngineRef.current?.createPeer(remoteSocketId, shouldCreateOffer, createOfferTransceivers)
      || peersRef.current.get(remoteSocketId);
  }

  function refreshPeerTransceivers(peer, makeSendRecv = false) {
    voiceEngineRef.current?.refreshPeerTransceivers(peer, makeSendRecv);
  }

  async function sendOffer(remoteSocketId, pc) {
    await voiceEngineRef.current?.sendOffer(remoteSocketId, pc);
  }

  async function flushPendingIce(remoteSocketId) {
    await voiceEngineRef.current?.flushPendingIce(remoteSocketId);
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
    voiceEngineRef.current?.replaceTrack(kind, track);
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
    voiceEngineRef.current?.syncLocalTracksToPeer(peer);
    if (screenTrackRef.current && peer?.videoSender) {
      configureVideoSender(peer.videoSender, "screen", peersRef.current.size, streamPreset);
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
      const screenConstraints = getScreenShareConstraints(streamPreset);
      const screenStream = await requestScreenShareStream(screenConstraints);
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
    const mixedAudio = createMixedAudioTrack(displayAudioTrack, audioTrackRef.current);
    if (!mixedAudio?.track) return;
    audioMixContextRef.current = mixedAudio.context;
    microphoneGainRef.current = mixedAudio.microphoneGain;
    mixedAudioTrackRef.current = mixedAudio.track;
    replaceSenderTrackForAll("audio", mixedAudioTrackRef.current);
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
    voiceEngineRef.current?.removePeer(remoteSocketId);
  }

  function closePeers() {
    voiceEngineRef.current?.closePeers();
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
    voiceEngineDetachRef.current?.();
    voiceEngineDetachRef.current = null;
    closePeers();
    voiceEngineRef.current = null;
    cleanupLocalMedia();
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocketInstance(null);
    hasJoinedRef.current = false;
    connectionStartedRef.current = false;
    setRoomExpiresAt(null);
    setRoomExpiryWarning("");
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
    setSelectedChannel("text-general");
    setActiveContentView("text");
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

  async function saveProfile(nextProfile) {
    const next = { ...profile, ...nextProfile };
    let canonical = next;
    if (accountUser) {
      canonical = await updateAccountProfile({
        displayName: next.displayName,
        avatarUrl: next.avatarUrl,
        pronouns: next.pronouns,
        aboutMe: next.aboutMe,
        accentColor: next.accentColor,
        customStatus: next.customStatus,
        status: next.status
      });
    }
    const localProfile = { ...next, ...canonical, nickname: canonical.displayName || next.nickname };
    setProfile(localProfile);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(localProfile));
    if (localProfile.avatarUrl) { localStorage.setItem(AVATAR_KEY, localProfile.avatarUrl); setAvatarUrl(localProfile.avatarUrl); } else { localStorage.removeItem(AVATAR_KEY); setAvatarUrl(""); }
    notify("Perfil salvo.");
    return localProfile;
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
    if (channel === "voice-general") {
      setActiveContentView("media");
      joinVoiceChannel();
      return;
    }
    setActiveContentView("text");
  }
  function handleToggleScreenShare() {
    setActiveContentView("media");
    return toggleScreenShare();
  }

  useEffect(() => {
    if (isScreenSharing || cameraEnabled) setIsPipDismissed(false);
  }, [cameraEnabled, isScreenSharing]);
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
          {isRoomExpired ? (
            <div className="room-expired-actions">
              <button className="primary-button" type="button" onClick={onBack}>Criar nova sala</button>
              <button className="secondary-button" type="button" onClick={onBack}>Voltar ao início</button>
            </div>
          ) : <button className="primary-button" type="button" onClick={onBack}>Voltar</button>}
        </section>
      </main>
    );
  }

  const isGuest = !accountUser;
  const localDisplayName = accountUser?.displayName || accountUser?.username || nickname || guestIdentity.nickname;
  const localAvatarUrl = isGuest ? "" : avatarUrl || accountUser?.avatarUrl || "";
  const localAvatarVariant = isGuest ? guestAvatarVariant : 0;
  const localParticipant = {
    id: accountUser?.id || "",
    userId: accountUser?.id || "",
    socketId: selfId || "local",
    nickname: localDisplayName,
    displayName: localDisplayName,
    username: accountUser?.username || "",
    avatarUrl: localAvatarUrl,
    avatarVariant: localAvatarVariant,
    badges: accountUser?.badges || [],
    isGuest,
    inRoom: true,
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
  const roomExpiryLabel = formatRoomRemaining(roomExpiresAt, roomExpiryNow);
  const callParticipants = voiceParticipants.filter(
    (participant) => participant.isScreenSharing || (participant.cameraEnabled && participant.stream)
  ).sort(
    (left, right) => Number(right.isScreenSharing) - Number(left.isScreenSharing)
  );
  const screenShareLabel = getActualScreenLabel(screenShareSettings, streamPreset);

  return (
    <main className={`page room-page app-shell ${activeContentView === "media" && !isMemberPanelOpen ? "call-members-collapsed" : ""}`}>
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
      <RoomRail roomCode={roomCode} roomName={roomName} recentRooms={recentRooms()} onHome={onBack} onSocial={onNavigateSocial} onOpenSwitcher={() => setIsRoomSwitcherOpen(true)} onOpenServer={onNavigateServer} />
      <Sidebar
        roomCode={roomCode}
        roomName={roomName}
        roomExpiryLabel={roomExpiryLabel}
        roomExpiryWarning={roomExpiryWarning}
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
        onOpenUserSettings={openSettings}
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
        {activeContentView === "media" ? <CallMediaView participants={voiceParticipants} channelName="Geral" participantCount={currentParticipantCount} maxParticipants={maxParticipants} isInVoice={isInVoice} isJoining={joinState === "joining"} isDisconnected={joinState === "disconnected"} viewMode={viewMode} onViewModeChange={setViewMode} focusedMediaId={focusedMediaId} onFocusParticipant={setFocusedMediaId} isDeafened={isDeafened} outputDeviceId={selectedOutputId} screenShareLabel={screenShareLabel} onVolumeChange={changeRemoteVolume} notify={notify} micEnabled={micEnabled} onToggleMicrophone={toggleMicrophone} cameraEnabled={cameraEnabled} onToggleCamera={toggleCamera} isScreenSharing={isScreenSharing} onToggleScreenShare={handleToggleScreenShare} onToggleDeafen={toggleDeafen} onLeaveVoice={leaveVoiceChannel} membersVisible={isMemberPanelOpen} onToggleMembers={() => setIsMemberPanelOpen((value) => !value)} streamPreset={streamPreset} onStreamPresetChange={setStreamPreset} /> : <section className="chat-stage channel-view">
          {isInVoice && callParticipants[0] && !isPipDismissed && <MediaPip participant={callParticipants[0]} onOpen={() => setActiveContentView("media")} onClose={() => setIsPipDismissed(true)} isDeafened={isDeafened} outputDeviceId={selectedOutputId} screenShareLabel={screenShareLabel} volume={callParticipants[0].volume} onVolumeChange={(volume) => changeRemoteVolume(callParticipants[0].socketId, volume)} notify={notify} />}
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

      {isProfilePopoverOpen && <ProfilePopover accountUser={accountUser} profile={profile} nickname={nickname} avatarUrl={localAvatarUrl} isGuest={isGuest} guestAvatarVariant={localAvatarVariant} isInVoice={isInVoice} voiceChannelName="Geral" connectionQuality={connectionQuality} onStatusChange={(status) => saveProfile({ status })} onEditProfile={openProfileSettings} onOpenSettings={openSettings} onLogout={logoutAccount} onCreateAccount={() => { setIsProfilePopoverOpen(false); setAuthModalMode("register"); }} onClose={() => setIsProfilePopoverOpen(false)} />}
      {selectedParticipantProfile && <SocialUserProfilePopover participant={selectedParticipantProfile.participant} anchorRect={selectedParticipantProfile.anchorRect} onClose={() => setSelectedParticipantProfile(null)} onMessage={async (participant) => { if (!participant?.userId) return; try { const conversation = await startConversation(participant.userId); setSelectedParticipantProfile(null); onNavigateDm?.(conversation.id, conversation); } catch { notify("Nao foi possivel abrir a conversa."); } }} onViewProfile={(participant) => { setSelectedParticipantProfile(null); if (participant?.userId) setSelectedSocialProfile(participant); }} />}
      {selectedSocialProfile && <SocialUserProfileModal userId={selectedSocialProfile.userId} initialUser={{ id: selectedSocialProfile.userId, username: selectedSocialProfile.username, displayName: selectedSocialProfile.displayName || selectedSocialProfile.nickname, avatarUrl: selectedSocialProfile.avatarUrl, avatarVariant: selectedSocialProfile.avatarVariant, badges: selectedSocialProfile.badges || [], status: "online" }} onClose={() => setSelectedSocialProfile(null)} onMessage={(conversation) => { setSelectedSocialProfile(null); onNavigateDm?.(conversation.id, conversation); }} />}
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
          profile={{ ...profile, ...(accountUser || {}), displayName: accountUser?.displayName || profile.displayName, username: accountUser?.username || "", avatarUrl: accountUser?.avatarUrl || avatarUrl }}
          onProfileChange={saveProfile}
          isPersistentProfile={Boolean(accountUser)}
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
