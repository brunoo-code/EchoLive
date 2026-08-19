import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";
import { useServers } from "../servers/ServerContext.jsx";

export default function RoomRail({ roomCode, roomName, recentRooms = [], onHome, onSocial, onOpenSwitcher, servers = [], activeServerId = "", onOpenServer, onCreateServer }) {
  const serverContext = useServers();
  const visibleServers = servers.length ? servers : serverContext.servers;
  const rooms = recentRooms.filter((room) => room.code !== roomCode).slice(0, 4);
  return <nav className="room-rail" aria-label="Navegacao de salas">
    <button type="button" className="rail-brand" onClick={onHome} title="Ir para a Home" aria-label="Ir para a Home"><BrandMark size={24} /></button>
    <button type="button" className="rail-social" onClick={onSocial} title="Abrir Amigos" aria-label="Abrir Amigos"><Icon name="account" size={17} /></button>
    <div className="rail-divider" />
    {roomCode && <button type="button" className="rail-room is-active" style={{ background: roomColor(roomCode) }} title={`${roomName || `Sala ${roomCode}`} - ${roomCode}`} aria-label={`Sala atual ${roomCode}`}><span>{roomInitials(roomName, roomCode)}</span></button>}
    {rooms.map((room) => <button type="button" className="rail-room" key={room.code} onClick={() => onOpenSwitcher()} style={{ background: roomColor(room.code) }} title={`${room.name} - ${room.code}`} aria-label={`${room.name} ${room.code}`}><span>{roomInitials(room.name, room.code)}</span></button>)}
    {visibleServers.length > 0 && <div className="rail-divider rail-server-divider" />}
    {visibleServers.slice(0, 12).map((server) => <button type="button" className={`rail-room rail-server ${server.id === activeServerId ? "is-active" : ""}`} key={server.id} onClick={() => onOpenServer?.(server.id)} style={{ background: serverColor(server.id) }} title={server.name} aria-label={`Servidor ${server.name}`}><span>{roomInitials(server.name, server.id)}</span></button>)}
    <div className="rail-divider rail-divider-bottom" />
    <button type="button" className="rail-add" onClick={onCreateServer || onOpenSwitcher} title={visibleServers.length ? "Criar servidor" : "Entrar ou criar uma sala"} aria-label={visibleServers.length ? "Criar servidor" : "Entrar ou criar uma sala"}><Icon name="plus" size={17} /></button>
  </nav>;
}

function roomInitials(name, code) { return String(name || code).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase().slice(0, 2); }
function roomColor(code) { let hash = 0; for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) % 360; return `hsl(${hash} 62% 42%)`; }
function serverColor(id) { let hash = 0; for (const char of String(id || "")) hash = (hash * 31 + char.charCodeAt(0)) % 360; return `hsl(${hash} 55% 36%)`; }
