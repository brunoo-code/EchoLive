export default function UserStatusBadge({ status = "online" }) {
  const normalized = status === "dnd" || status === "Nao perturbe" ? "dnd" : "online";
  return <span className={`user-status-badge user-status-badge--${normalized}`} title={normalized === "dnd" ? "Nao perturbe" : "Online"} aria-label={normalized === "dnd" ? "Nao perturbe" : "Online"} />;
}
