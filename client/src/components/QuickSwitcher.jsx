import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const RECENT_ROOMS_KEY = "echolive.recentRooms";

function readRecentRooms() {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || "[]");
    return Array.isArray(stored) ? stored.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function itemMatches(item, query) {
  if (!query) return true;
  return `${item.title} ${item.subtitle}`.toLowerCase().includes(query);
}

export default function QuickSwitcher({ open, onClose, onNavigateRoom, onNavigateSocial, onNavigateServers, onNavigateServer, onNavigateDm, servers = [], friends = [], conversations = [] }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const groups = useMemo(() => {
    const recentRooms = readRecentRooms();
    return [
      {
        label: "Navegacao",
        items: [
          { id: "nav-friends", title: "Amigos", subtitle: "Abrir sua area social", icon: "account", onSelect: onNavigateSocial },
          { id: "nav-servers", title: "Servidores", subtitle: "Abrir seus servidores", icon: "server", onSelect: onNavigateServers }
        ]
      },
      {
        label: "Salas recentes",
        items: recentRooms.map((room) => ({
          id: `room-${room.code}`,
          title: room.name || `Sala ${room.code}`,
          subtitle: `${String(room.code || "").toUpperCase()} - Sala recente`,
          icon: "voice",
          onSelect: () => onNavigateRoom?.(room.code)
        }))
      },
      {
        label: "Servidores",
        items: servers.slice(0, 8).map((server) => ({
          id: `server-${server.id}`,
          title: server.name,
          subtitle: "Servidor",
          icon: "server",
          onSelect: () => onNavigateServer?.(server.id)
        }))
      },
      {
        label: "Mensagens diretas",
        items: conversations.slice(0, 8).map((conversation) => ({
          id: `dm-${conversation.id}`,
          title: conversation.user?.displayName || conversation.user?.username || "Conversa",
          subtitle: conversation.user?.isOfficial ? "EchoLive · Oficial" : `@${conversation.user?.username || "usuario"}`,
          icon: conversation.user?.isOfficial ? "sparkles" : "chat",
          onSelect: () => onNavigateDm?.(conversation.id)
        }))
      },
      {
        label: "Pessoas",
        items: friends.slice(0, 8).map((friend) => ({
          id: `friend-${friend.id}`,
          title: friend.displayName || friend.username,
          subtitle: `@${friend.username}`,
          icon: "account",
          onSelect: onNavigateSocial
        }))
      }
    ];
  }, [conversations, friends, onNavigateDm, onNavigateRoom, onNavigateServer, onNavigateServers, onNavigateSocial, servers]);

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return groups.map((group) => ({ ...group, items: group.items.filter((item) => itemMatches(item, normalizedQuery)) })).filter((group) => group.items.length > 0);
  }, [groups, query]);
  const visibleItems = useMemo(() => visibleGroups.flatMap((group) => group.items), [visibleGroups]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => visibleItems.length ? (current + 1) % visibleItems.length : 0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => visibleItems.length ? (current - 1 + visibleItems.length) % visibleItems.length : 0);
      } else if (event.key === "Enter" && visibleItems[activeIndex]) {
        event.preventDefault();
        visibleItems[activeIndex].onSelect?.();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, onClose, open, visibleItems]);

  useEffect(() => {
    if (activeIndex >= visibleItems.length) setActiveIndex(Math.max(0, visibleItems.length - 1));
  }, [activeIndex, visibleItems.length]);

  if (!open) return null;

  let itemIndex = -1;
  return <div className="quick-switcher-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="quick-switcher" role="dialog" aria-modal="true" aria-labelledby="quick-switcher-title">
      <div className="quick-switcher-heading">
        <Icon name="search" size={17} />
        <label htmlFor="quick-switcher-input" id="quick-switcher-title">Ir para</label>
        <kbd>ESC</kbd>
      </div>
      <input ref={inputRef} id="quick-switcher-input" className="quick-switcher-input" value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} placeholder="Buscar salas, servidores, amigos ou DMs" autoComplete="off" />
      <div className="quick-switcher-results">
        {visibleGroups.map((group) => <div className="quick-switcher-group" key={group.label}>
          <span className="quick-switcher-group-label">{group.label}</span>
          {group.items.map((item) => {
            itemIndex += 1;
            const currentIndex = itemIndex;
            return <button type="button" className={`quick-switcher-item ${currentIndex === activeIndex ? "is-active" : ""}`} key={item.id} onMouseEnter={() => setActiveIndex(currentIndex)} onClick={() => { item.onSelect?.(); onClose(); }}>
              <span className="quick-switcher-item-icon"><Icon name={item.icon} size={16} /></span>
              <span className="quick-switcher-item-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
              <Icon name="chevron" size={14} className="quick-switcher-item-arrow" />
            </button>;
          })}
        </div>)}
        {!visibleItems.length && <div className="quick-switcher-empty"><Icon name="search" size={20} /><strong>Nada encontrado</strong><span>Tente outro nome ou codigo.</span></div>}
      </div>
      <footer className="quick-switcher-footer"><span><kbd>Up</kbd><kbd>Down</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></footer>
    </section>
  </div>;
}
