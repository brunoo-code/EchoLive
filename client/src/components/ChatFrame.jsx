/* SPDX-License-Identifier: AGPL-3.0-or-later. Presentation hierarchy directly derived from Fluxer chat surfaces. */
import Icon from "./Icon.jsx";

export function ChatHeader({ title, subtitle = "", type = "text", meta = "", searchValue, onSearchChange, searchPlaceholder = "Buscar mensagens" }) {
  return <header className="chat-header">
    <div className="chat-header-main">
      <p className="channel-title"><span className="channel-kind" aria-hidden="true">{type === "voice" ? <Icon name="voice" size={17} /> : "#"}</span>{title}</p>
      {subtitle && <p className="channel-subtitle">{subtitle}</p>}
    </div>
    <div className="chat-header-tools">
      {meta && <span className="chat-header-meta">{meta}</span>}
      {typeof onSearchChange === "function" && <label className="chat-header-search"><Icon name="search" size={14} /><span className="sr-only">Buscar mensagens</span><input value={searchValue || ""} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} /></label>}
    </div>
  </header>;
}

export function ChatViewport({ children, ariaLive = "polite" }) {
  return <div className="message-list" aria-live={ariaLive}>{children}</div>;
}

export function ChatComposerFrame({ children, onSubmit }) {
  return <form className="chat-composer" onSubmit={onSubmit}><div className="composer-surface"><div className="composer-surface-inner">{children}</div></div></form>;
}

export function ChatComposerRow({ children }) {
  return <div className="composer-row">{children}</div>;
}
