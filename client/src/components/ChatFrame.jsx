/* SPDX-License-Identifier: AGPL-3.0-or-later. Presentation hierarchy directly derived from Fluxer chat surfaces. */
import Icon from "./Icon.jsx";
import { SearchInput } from "./FluxerPrimitives.jsx";

export function ChatHeader({ title, subtitle = "", type = "text", meta = "", searchValue, onSearchChange, searchPlaceholder = "Buscar mensagens" }) {
  return <header className="chat-header">
    <div className="chat-header-main">
      <p className="channel-title"><span className="channel-kind" aria-hidden="true">{type === "voice" ? <Icon name="voice" size={17} /> : "#"}</span>{title}</p>
      {subtitle && <p className="channel-subtitle">{subtitle}</p>}
    </div>
    <div className="chat-header-tools">
      {meta && <span className="chat-header-meta">{meta}</span>}
      {typeof onSearchChange === "function" && <SearchInput className="chat-header-search" value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} label={searchPlaceholder} />}
    </div>
  </header>;
}

export function ChatViewport({ children, ariaLive = "polite" }) {
  return <div className="message-list" aria-live={ariaLive}>{children}</div>;
}

export function ChatComposerFrame({ children, onSubmit }) {
  return <form className="chat-composer" onSubmit={onSubmit} data-flx="channel.composer.surface"><div className="composer-surface" data-composer-surface="canonical"><div className="composer-surface-inner">{children}</div></div></form>;
}

export function ChatComposerRow({ children }) {
  return <div className="composer-row">{children}</div>;
}
