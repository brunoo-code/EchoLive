import BrandMark from "./BrandMark.jsx";

export default function RoomRail({ roomCode, roomName, recentRooms, onHome, onOpenSwitcher }) {
  const rooms = recentRooms.filter((room) => room.code !== roomCode).slice(0, 4);
  return <nav className="room-rail" aria-label="Navegacao de salas">
    <button type="button" className="rail-brand" onClick={onHome} title="Ir para a Home" aria-label="Ir para a Home"><BrandMark size={24} /></button>
    <div className="rail-divider" />
    <button type="button" className="rail-room is-active" style={{ background: roomColor(roomCode) }} title={`${roomName || `Sala ${roomCode}`} - ${roomCode}`} aria-label={`Sala atual ${roomCode}`}><span>{roomInitials(roomName, roomCode)}</span></button>
    {rooms.map((room) => <button type="button" className="rail-room" key={room.code} onClick={() => onOpenSwitcher()} style={{ background: roomColor(room.code) }} title={`${room.name} - ${room.code}`} aria-label={`${room.name} ${room.code}`}><span>{roomInitials(room.name, room.code)}</span></button>)}
    <div className="rail-divider rail-divider-bottom" />
    <button type="button" className="rail-add" onClick={onOpenSwitcher} title="Entrar ou criar uma sala" aria-label="Entrar ou criar uma sala">+</button>
  </nav>;
}

function roomInitials(name, code) { return String(name || code).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase().slice(0, 2); }
function roomColor(code) { let hash = 0; for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) % 360; return `hsl(${hash} 62% 42%)`; }
