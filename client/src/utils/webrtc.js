const SERVER_URL = import.meta.env.VITE_SERVER_URL || (
  typeof window !== "undefined" && window.location.port === "5173"
    ? "http://localhost:3001"
    : window.location.origin
);

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
