import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState } from "react";
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
      return <BadgeItem key={badge.code} meta={meta} compact={compact} />;
    })}
    {overflowCount > 0 && <span className="user-badge-overflow" title={`${overflowCount} outras insígnias`} aria-label={`${overflowCount} outras insígnias`}>+{overflowCount}</span>}
  </span>;
}

function BadgeItem({ meta, compact }) {
  const badgeRef = useRef(null);
  const tooltipRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });

  useLayoutEffect(() => {
    if (!isOpen || !badgeRef.current || !tooltipRef.current) return;
    const anchor = badgeRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const padding = 8;
    const gap = 8;
    const canOpenAbove = anchor.top - tooltip.height - gap >= padding;
    const top = canOpenAbove
      ? anchor.top - tooltip.height - gap
      : Math.min(window.innerHeight - tooltip.height - padding, anchor.bottom + gap);
    const left = Math.max(
      padding,
      Math.min(window.innerWidth - tooltip.width - padding, anchor.left + (anchor.width - tooltip.width) / 2)
    );
    setPosition({ top: Math.max(padding, top), left, ready: true });
  }, [isOpen]);

  const tooltip = isOpen && typeof document !== "undefined"
    ? createPortal(
        <span ref={tooltipRef} className="user-badge-tooltip" style={{ top: position.top, left: position.left, visibility: position.ready ? "visible" : "hidden" }} role="tooltip">
          <strong>{meta.label}</strong>
          <span>{meta.description}</span>
        </span>,
        document.body
      )
    : null;

  return <>
    <span
      ref={badgeRef}
      className="user-badge"
      tabIndex={0}
      role="img"
      aria-label={`${meta.label}. ${meta.description}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      <BrandMark size={compact ? 16 : 18} className="user-badge-mark" />
    </span>
    {tooltip}
  </>;
}
