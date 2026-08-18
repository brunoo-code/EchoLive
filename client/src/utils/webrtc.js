const configuredServerUrl = String(import.meta.env.VITE_SERVER_URL || "").trim().replace(/\/$/, "");
const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
const isLocalBrowser = typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
const isLoopbackUrl = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(configuredServerUrl);

// Production is served by the Node server itself. A local VITE_SERVER_URL must
// never escape into a deployed HTTPS page, where it becomes a network failure.
const SERVER_URL = configuredServerUrl && (!browserOrigin || isLocalBrowser || !isLoopbackUrl)
  ? configuredServerUrl
  : isLocalBrowser
    ? "http://localhost:3001"
    : browserOrigin;

export async function getPeerConnectionConfig() {
  try {
    const response = await fetch(`${SERVER_URL}/ice-config`);
    if (!response.ok) {
      throw new Error("ICE config unavailable");
    }

    return await response.json();
  } catch {
    return {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    };
  }
}

export { SERVER_URL };
