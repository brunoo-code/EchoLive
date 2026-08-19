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
    const gap = 10;
    const maxTop = Math.max(8, window.innerHeight - bounds.height - 8);
    const preferredLeft = anchorRect.left - bounds.width - gap;
    const left = preferredLeft >= 8 ? preferredLeft : Math.min(window.innerWidth - bounds.width - 8, anchorRect.right + gap);
    setPosition({
      top: Math.min(maxTop, Math.max(8, anchorRect.top)),
      left: Math.max(8, left),
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
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
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
          <span>@{username}</span>
          <div className="social-user-popover-meta"><span className="visitor-badge">{isGuest ? "Visitante" : "Online"}</span><UserBadges badges={participant.badges} compact /></div>
        </div>
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
