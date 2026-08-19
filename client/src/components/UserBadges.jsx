import BrandMark from "./BrandMark.jsx";

const BADGE_META = {
  echolive_beta: {
    label: "EchoLive Beta",
    description: "Participou da fase beta do EchoLive.",
    iconKey: "eko-beta"
  }
};

export default function UserBadges({ badges = [], compact = false }) {
  const supportedBadges = badges.filter((badge) => badge?.code && BADGE_META[badge.code]);
  const visibleBadges = supportedBadges.slice(0, 3);
  const overflowCount = Math.max(0, supportedBadges.length - visibleBadges.length);
  if (!visibleBadges.length) return null;

  return <span className={`user-badges ${compact ? "is-compact" : ""}`} aria-label="Insígnias do usuário">
    {visibleBadges.map((badge) => {
      const meta = BADGE_META[badge.code];
      return <span className="user-badge" key={badge.code} tabIndex={0} role="img" aria-label={`${meta.label}. ${meta.description}`}>
        <BrandMark size={compact ? 16 : 18} className="user-badge-mark" />
        <span className="user-badge-tooltip" role="tooltip"><strong>{meta.label}</strong><span>{meta.description}</span></span>
      </span>;
    })}
    {overflowCount > 0 && <span className="user-badge-overflow" title={`${overflowCount} outras insígnias`} aria-label={`${overflowCount} outras insígnias`}>+{overflowCount}</span>}
  </span>;
}
