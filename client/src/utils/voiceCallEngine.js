export function createVoiceCallEngine({
  socket,
  peerStore = new Map(),
  pendingIceStore = new Map(),
  remoteStreamsStore = new Map(),
  getIceConfig = () => ({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }),
  getLocalTracks = () => ({ audio: null, video: null }),
  onRemoteStream = () => {},
  debug = false
}) {
  if (!socket) {
    throw new Error("A socket is required to create a voice call engine.");
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

  function syncLocalTracksToPeer(peer) {
    if (!peer) return;

    const tracks = getLocalTracks() || {};
    const audioTrack = tracks.audio?.readyState === "live" ? tracks.audio : null;
    const videoTrack = tracks.video?.readyState === "live" ? tracks.video : null;

    peer.audioSender?.replaceTrack(audioTrack).catch(() => {});
    peer.videoSender?.replaceTrack(videoTrack).catch(() => {});
  }

  async function flushPendingIce(remoteSocketId) {
    const peer = peerStore.get(remoteSocketId);
    const pending = pendingIceStore.get(remoteSocketId) || [];

    if (!peer?.pc.remoteDescription) return;

    for (const candidate of pending) {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }

    pendingIceStore.delete(remoteSocketId);
  }

  async function sendOffer(remoteSocketId, pc = peerStore.get(remoteSocketId)?.pc) {
    if (!pc || pc.signalingState !== "stable") return;

    syncLocalTracksToPeer(peerStore.get(remoteSocketId));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer", { to: remoteSocketId, offer });
  }

  function removePeer(remoteSocketId) {
    const peer = peerStore.get(remoteSocketId);
    peer?.pc.close();
    peerStore.delete(remoteSocketId);
    pendingIceStore.delete(remoteSocketId);
    remoteStreamsStore.get(remoteSocketId)?.getTracks().forEach((track) => track.stop());
    remoteStreamsStore.delete(remoteSocketId);
  }

  function createPeer(remoteSocketId, shouldCreateOffer = false, createOfferTransceivers = true) {
    const existingPeer = peerStore.get(remoteSocketId);
    if (existingPeer) return existingPeer;

    const pc = new RTCPeerConnection(getIceConfig());
    const peer = { pc, audioSender: null, videoSender: null };

    if (createOfferTransceivers) {
      pc.addTransceiver("audio", { direction: "sendrecv" });
      pc.addTransceiver("video", { direction: "sendrecv" });
    }

    peerStore.set(remoteSocketId, peer);
    refreshPeerTransceivers(peer, createOfferTransceivers);
    syncLocalTracksToPeer(peer);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { to: remoteSocketId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (debug) {
        console.debug("[RTC DEBUG] ontrack", {
          peer: remoteSocketId,
          kind: event.track.kind,
          id: event.track.id,
          readyState: event.track.readyState
        });
      }

      const stream = remoteStreamsStore.get(remoteSocketId) || new MediaStream();
      if (!stream.getTracks().some((track) => track.id === event.track.id)) {
        stream.addTrack(event.track);
      }
      remoteStreamsStore.set(remoteSocketId, stream);
      onRemoteStream(remoteSocketId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        removePeer(remoteSocketId);
      }
    };

    if (shouldCreateOffer) {
      window.setTimeout(() => sendOffer(remoteSocketId, pc).catch(() => {}), 0);
    }

    return peer;
  }

  async function handleOffer({ from, offer }, prepareLocalMedia = async () => {}) {
    await prepareLocalMedia();
    const peer = createPeer(from, false, false);
    await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
    refreshPeerTransceivers(peer, true);
    syncLocalTracksToPeer(peer);
    await flushPendingIce(from);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    socket.emit("webrtc-answer", { to: from, answer });
  }

  async function handleAnswer({ from, answer }) {
    const peer = peerStore.get(from);
    if (!peer) return;
    await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await flushPendingIce(from);
  }

  async function handleIce({ from, candidate }, prepareLocalMedia = async () => {}) {
    await prepareLocalMedia();
    const peer = peerStore.get(from) || createPeer(from, false, false);

    if (!peer.pc.remoteDescription) {
      pendingIceStore.set(from, [...(pendingIceStore.get(from) || []), candidate]);
      return;
    }

    await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  function attachSignaling({ prepareLocalMedia = async () => {} } = {}) {
    const onOffer = (payload) => { handleOffer(payload, prepareLocalMedia).catch(() => {}); };
    const onAnswer = (payload) => { handleAnswer(payload).catch(() => {}); };
    const onIce = (payload) => { handleIce(payload, prepareLocalMedia).catch(() => {}); };

    socket.on("webrtc-offer", onOffer);
    socket.on("webrtc-answer", onAnswer);
    socket.on("ice-candidate", onIce);

    return () => {
      socket.off("webrtc-offer", onOffer);
      socket.off("webrtc-answer", onAnswer);
      socket.off("ice-candidate", onIce);
    };
  }

  function replaceTrack(kind, track) {
    const safeTrack = track?.readyState === "live" ? track : null;
    peerStore.forEach((peer) => {
      const sender = kind === "audio" ? peer.audioSender : peer.videoSender;
      sender?.replaceTrack(safeTrack).catch(() => {});
    });
  }

  function closePeers() {
    Array.from(peerStore.keys()).forEach(removePeer);
  }

  return {
    createPeer,
    sendOffer,
    flushPendingIce,
    refreshPeerTransceivers,
    syncLocalTracksToPeer,
    replaceTrack,
    removePeer,
    closePeers,
    attachSignaling,
    getPeer: (remoteSocketId) => peerStore.get(remoteSocketId),
    getPeers: () => Array.from(peerStore.values())
  };
}
