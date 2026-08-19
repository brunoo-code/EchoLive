import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";
import UserBadges from "./UserBadges.jsx";
import UserStatusBadge from "./UserStatusBadge.jsx";

export default function SocialUserProfilePopover({ participant, anchorRect, onClose, onMessage, onViewProfile }) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: anchorRect?.top || 8, left: anchorRect?.left || 8, ready: false });
  const displayName = participant?.displayName || participant?.nickname || participant?.username || "Usuario";
  const username = participant?.username || participant?.nickname || "usuario";
  const status = participant?.status === "dnd" ? "dnd" : "online";
  const isGuest = Boolean(participant?.isGuest);

  useLayoutEffect(() => {
    const node = popoverRef.current;
    if (!node || !anchorRect) return;
    const bounds = node.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 10;
    const maxTop = Math.max(viewportPadding, window.innerHeight - bounds.height - viewportPadding);
    const preferredLeft = anchorRect.left - bounds.width - gap;
    const rightFallback = anchorRect.right + gap;
    const left = preferredLeft >= viewportPadding
      ? preferredLeft
      : rightFallback + bounds.width <= window.innerWidth - viewportPadding
        ? rightFallback
        : Math.min(window.innerWidth - bounds.width - viewportPadding, Math.max(viewportPadding, preferredLeft));
    setPosition({
      top: Math.min(maxTop, Math.max(viewportPadding, anchorRect.top)),
      left: Math.max(viewportPadding, left),
      ready: true
    });
  }, [anchorRect]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!popoverRef.current?.contains(event.target)) onClose?.();
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    function handleViewportChange() {
      onClose?.();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [onClose]);

  if (!participant) return null;
  return createPortal(
    <section ref={popoverRef} className="social-user-popover" style={{ top: position.top, left: position.left, visibility: position.ready ? "visible" : "hidden" }} role="dialog" aria-label={`Perfil de ${displayName}`}>
      <div className="social-user-popover-cover" />
      <div className="social-user-popover-body">
        <div className="social-user-popover-avatar">
          {participant.avatarUrl ? <img src={participant.avatarUrl} alt="" /> : isGuest ? <BrandMark size={52} variant={participant.avatarVariant} /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
          <UserStatusBadge status={status} size="lg" />
        </div>
        <div className="social-user-popover-identity">
          <strong>{displayName}</strong>
          <div className="social-user-popover-username"><span>@{username}</span><UserBadges badges={participant.badges} /></div>
        </div>
        <div className="social-user-popover-meta"><span className="visitor-badge">{isGuest ? "Visitante" : "Online"}</span></div>
        <p className="social-user-popover-presence"><i className="online-indicator" aria-hidden="true" />{participant.isSpeaking ? "Falando agora" : participant.isLocal ? "Voce" : "Online na sala"}</p>
        <div className="social-user-popover-actions">
          {!isGuest && <button type="button" className="primary-button" onClick={() => onMessage?.(participant)}><Icon name="message" size={15} />Mensagem</button>}
          <button type="button" className="secondary-button" onClick={() => onViewProfile?.(participant)}><Icon name="account" size={15} />Ver perfil</button>
        </div>
      </div>
    </section>,
    document.body
  );
}
