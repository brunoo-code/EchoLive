export default function UserStatusBadge({ status = "online", size = "md" }) {
  const normalized = status === "dnd" || status === "Nao perturbe" ? "dnd" : status === "invisible" ? "invisible" : status === "offline" ? "offline" : "online";
  const label = normalized === "dnd" ? "Nao perturbe" : normalized === "invisible" ? "Invisivel" : normalized === "offline" ? "Offline" : "Online";
  return <span className={`user-status-badge user-status-badge--${normalized} user-status-badge--${size}`} title={label} aria-label={label} />;
}
