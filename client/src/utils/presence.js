export const PRESENCE_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "dnd", label: "Não perturbe" },
  { value: "invisible", label: "Invisível" }
];

export function normalizePresence(status, fallback = "online") {
  return PRESENCE_OPTIONS.some((option) => option.value === status) ? status : fallback;
}

export function presenceLabel(status) {
  return PRESENCE_OPTIONS.find((option) => option.value === normalizePresence(status))?.label || "Online";
}

export function publicPresence(status, isSelf = false) {
  const normalized = normalizePresence(status);
  return normalized === "invisible" && !isSelf ? "offline" : normalized;
}
