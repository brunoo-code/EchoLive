import Icon from "./Icon.jsx";

export function ChatHeader({ title, subtitle = "", type = "text", meta = "" }) {
  return <header className="chat-header">
    <div>
      <p className="channel-title"><span className="channel-kind" aria-hidden="true">{type === "voice" ? <Icon name="voice" size={17} /> : "#"}</span>{title}</p>
      {subtitle && <p className="channel-subtitle">{subtitle}</p>}
    </div>
    {meta && <span className="chat-header-meta">{meta}</span>}
  </header>;
}

export function ChatViewport({ children, ariaLive = "polite" }) {
  return <div className="message-list" aria-live={ariaLive}>{children}</div>;
}

export function ChatComposerFrame({ children, onSubmit }) {
  return <form className="chat-composer" onSubmit={onSubmit}>{children}</form>;
}

export function ChatComposerRow({ children }) {
  return <div className="composer-row">{children}</div>;
}
