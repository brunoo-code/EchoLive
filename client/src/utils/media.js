export async function requestInitialMedia(notify, deviceIds = {}) {
  try {
    const combinedStream = await navigator.mediaDevices.getUserMedia({
      audio: getAudioConstraints(deviceIds.audioDeviceId),
      video: getVideoConstraints(deviceIds.videoDeviceId)
    });

    return {
      stream: combinedStream,
      audioTrack: combinedStream.getAudioTracks()[0] || null,
      videoTrack: combinedStream.getVideoTracks()[0] || null
    };
  } catch {
    const stream = new MediaStream();
    let audioTrack = null;
    let videoTrack = null;

    const audioResult = await requestSingleKind("audio", deviceIds.audioDeviceId);
    if (audioResult.track) {
      audioTrack = audioResult.track;
      stream.addTrack(audioTrack);
    } else {
      notify("Permissao de microfone negada.");
    }

    const videoResult = await requestSingleKind("video", deviceIds.videoDeviceId);
    if (videoResult.track) {
      videoTrack = videoResult.track;
      stream.addTrack(videoTrack);
    } else {
      notify("Permissao de camera negada.");
    }

    return { stream, audioTrack, videoTrack };
  }
}

export async function requestSingleKind(kind, deviceId = "") {
  try {
    const constraints = kind === "audio"
      ? { audio: getAudioConstraints(deviceId) }
      : { video: getVideoConstraints(deviceId) };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = kind === "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
    return { stream, track };
  } catch (error) {
    return { stream: null, track: null, error };
  }
}

function getAudioConstraints(deviceId = "") {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {})
  };
}

function getVideoConstraints(deviceId = "") {
  return deviceId ? { deviceId: { exact: deviceId } } : true;
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
