const UI_SOUND_VOLUME = 0.18;
const PROFILES = {
  "mic-mute": [220, 150, 0.07], "mic-unmute": [420, 620, 0.08],
  "voice-join": [360, 560, 0.1], "voice-leave": [500, 280, 0.1],
  "deafen-on": [260, 180, 0.07], "deafen-off": [300, 460, 0.07],
  "screen-start": [300, 720, 0.09], "screen-stop": [620, 300, 0.09],
  "message-send": [520, 680, 0.045], "message-received": [300, 390, 0.06],
  "dmReceived": [580, 760, 0.075],
  "dmSent": [520, 690, 0.045],
  "friendRequestReceived": [430, 650, 0.085],
  "friendAccepted": [520, 820, 0.09],
  "friendRequestSent": [390, 520, 0.055]
};
let contextRef = null;
let activeSource = null;
let unlockBound = false;

export function uiSoundsEnabled(presenceStatus) {
  if (presenceStatus === "dnd" || presenceStatus === "Não perturbe") return false;
  try {
    return window.localStorage.getItem("echolive.uiSounds") !== "false";
  } catch {
    return true;
  }
}

function bindContextUnlock() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const unlock = () => contextRef?.resume?.().catch(() => {});
  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, unlock, { capture: true, once: true });
  });
}

export function playUiSound(name, enabled = true) {
  if (!enabled || typeof window === "undefined") return;
  const profile = PROFILES[name];
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!profile || !Context) return;
  try {
    contextRef ||= new Context();
    bindContextUnlock();
    const context = contextRef;
    if (context.state === "suspended") context.resume().catch(() => {});
    activeSource?.stop?.();
    const [startFrequency, endFrequency, duration] = profile;
    const start = context.currentTime;
    const end = start + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(UI_SOUND_VOLUME, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(gain).connect(context.destination);
    activeSource = oscillator;
    oscillator.onended = () => {
      if (activeSource === oscillator) activeSource = null;
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(end + 0.01);
  } catch {
    // UI feedback must never interrupt the main action.
  }
}
