/* SPDX-License-Identifier: AGPL-3.0-or-later. */
/*
 * Presentation primitives directly derived from Fluxer's frontend primitives.
 * EchoLive supplies the data, labels and handlers; no Fluxer state or network
 * code is used here.
 */
import Icon from "./Icon.jsx";

export function FocusRing({ children, className = "", ...props }) {
  return <div className={`fluxer-focus-ring ${className}`.trim()} {...props}>{children}</div>;
}

export function IconButton({ label, children, className = "", ...props }) {
  return <button type="button" className={`fluxer-icon-button ${className}`.trim()} aria-label={label} title={label} {...props}>{children}</button>;
}

export function SearchInput({ value, onChange, placeholder, label = placeholder, className = "" }) {
  return <label className={`fluxer-search-input ${className}`.trim()}>
    <Icon name="search" size={15} />
    <span className="sr-only">{label}</span>
    <input value={value || ""} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} aria-label={label} />
  </label>;
}

export function StatusDot({ status = "offline", className = "" }) {
  return <span className={`fluxer-status-dot status-${status} ${className}`.trim()} aria-hidden="true" />;
}

export function Badge({ children, tone = "neutral", className = "" }) {
  return <span className={`fluxer-badge tone-${tone} ${className}`.trim()}>{children}</span>;
}

export function MenuSurface({ children, className = "", ...props }) {
  return <div className={`fluxer-menu-surface ${className}`.trim()} role="menu" {...props}>{children}</div>;
}

export function MenuItem({ icon, children, danger = false, ...props }) {
  return <button type="button" role="menuitem" className={`fluxer-menu-item ${danger ? "is-danger" : ""}`.trim()} {...props}>{icon}{children}</button>;
}
