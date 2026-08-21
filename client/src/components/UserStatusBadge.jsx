export default function UserStatusBadge({ status = "online", size = "md", className = "" }) {
  const normalized = status === "dnd" || status === "Nao perturbe" || status === "Não perturbe" ? "dnd" : status === "invisible" ? "invisible" : status === "offline" ? "offline" : "online";
  const label = normalized === "dnd" ? "Não perturbe" : normalized === "invisible" ? "Invisível" : normalized === "offline" ? "Offline" : "Online";
  return <span className={`user-status-badge user-status-badge--${normalized} user-status-badge--${size} ${className}`.trim()} title={label} aria-label={label} />;
}
