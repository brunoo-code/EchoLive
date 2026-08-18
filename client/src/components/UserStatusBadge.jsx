export default function UserStatusBadge({ status = "online", size = "md" }) {
  const normalized = status === "dnd" || status === "Nao perturbe" ? "dnd" : "online";
  return <span className={`user-status-badge user-status-badge--${normalized} user-status-badge--${size}`} title={normalized === "dnd" ? "Nao perturbe" : "Online"} aria-label={normalized === "dnd" ? "Nao perturbe" : "Online"} />;
}
