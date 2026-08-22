/* SPDX-License-Identifier: AGPL-3.0-or-later. Presentation hierarchy directly derived from Fluxer chat surfaces. */
import Icon from "./Icon.jsx";
import { SearchInput } from "./FluxerPrimitives.jsx";

export function ChatHeader({ title, subtitle = "", type = "text", meta = "", searchValue, onSearchChange, searchPlaceholder = "Buscar mensagens" }) {
  return <header className="fluxer-channel-header" data-flx="channel.header.header-container">
    <div className="fluxer-channel-header-left" data-flx="channel.header.header-left-section">
      <p className="fluxer-channel-title"><span className="fluxer-channel-kind" aria-hidden="true">{type === "voice" ? <Icon name="voice" size={17} /> : "#"}</span>{title}</p>
      {subtitle && <p className="fluxer-channel-subtitle">{subtitle}</p>}
    </div>
    <div className="fluxer-channel-header-right" data-flx="channel.header.header-right-section">
      {meta && <span className="fluxer-channel-meta">{meta}</span>}
      {typeof onSearchChange === "function" && <SearchInput className="fluxer-channel-header-search" value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} label={searchPlaceholder} />}
    </div>
  </header>;
}

export function ChatViewport({ children, ariaLive = "polite" }) {
  return <div className="fluxer-message-scroller" aria-live={ariaLive} data-flx="channel.message-scroller"><div className="fluxer-message-list" data-flx="channel.message-list">{children}</div></div>;
}

export function ChatComposerFrame({ children, onSubmit }) {
  return <form className="fluxer-composer" onSubmit={onSubmit} data-flx="channel.composer.surface"><div className="fluxer-composer-surface" data-composer-surface="canonical"><div className="fluxer-composer-inner">{children}</div></div></form>;
}

export function ChatComposerRow({ children }) {
  return <div className="fluxer-composer-row" data-flx="channel.composer.editor-row">{children}</div>;
}
