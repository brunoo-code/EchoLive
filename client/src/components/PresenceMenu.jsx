import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import UserStatusBadge from "./UserStatusBadge.jsx";
import { normalizePresence, PRESENCE_OPTIONS, presenceLabel } from "../utils/presence.js";

export default function PresenceMenu({ value, onChange, placement = "below", className = "", label = "Status" }) {
  const [open, setOpen] = useState(false);
  const [opensLeft, setOpensLeft] = useState(false);
  const rootRef = useRef(null);
  const current = normalizePresence(value);

  useLayoutEffect(() => {
    if (!open || placement !== "side") return;
    const rect = rootRef.current?.getBoundingClientRect();
    setOpensLeft(Boolean(rect && window.innerWidth - rect.right < 258 && rect.left >= 258));
  }, [open, placement]);

  useEffect(() => {
    if (!open) return undefined;
    function close(event) {
      if (event.type === "keydown") {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close, true);
    };
  }, [open]);

  function select(nextValue) {
    setOpen(false);
    onChange?.(nextValue);
  }

  return <div ref={rootRef} data-flx="app.presence-menu" className={`presence-menu fluxer-presence-menu presence-menu--${placement} ${opensLeft ? "opens-left" : ""} ${className}`.trim()}>
    <button type="button" className="profile-status-trigger status-menu-row" onClick={() => setOpen((currentOpen) => !currentOpen)} aria-expanded={open} aria-haspopup="menu">
      <UserStatusBadge status={current} size="sm" className="menu-status-dot status-menu-icon" />
      <span className="status-menu-text"><span className="status-menu-label">{presenceLabel(current)}</span></span>
      <Icon name="chevron" size={14} className="status-menu-chevron" />
    </button>
    {open && <div className="profile-status-options" data-flx="app.presence-menu.options" role="menu" aria-label={label}>
      {PRESENCE_OPTIONS.map((option) => <button type="button" role="menuitemradio" aria-checked={current === option.value} className={current === option.value ? "is-selected" : ""} key={option.value} onClick={() => select(option.value)}>
        <UserStatusBadge status={option.value} size="sm" className="menu-status-dot status-menu-icon" />
        <span className="status-menu-text"><span className="status-menu-label">{option.label}</span></span>
        {current === option.value && <Icon name="check" size={14} className="status-menu-chevron" />}
      </button>)}
    </div>}
  </div>;
}
