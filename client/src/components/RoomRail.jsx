export default function RoomRail({ roomCode, roomName, recentRooms, onHome, onOpenSwitcher }) {
  const rooms = recentRooms.filter((room) => room.code !== roomCode).slice(0, 4);
  return <nav className="room-rail" aria-label="Navegacao de salas">
    <button type="button" className="rail-brand" onClick={onHome} title="Ir para a Home" aria-label="Ir para a Home"><span className="brand-symbol" aria-hidden="true">E</span></button>
    <div className="rail-divider" />
    <button type="button" className="rail-room is-active" title={`${roomName || `Sala ${roomCode}`} - ${roomCode}`} aria-label={`Sala atual ${roomCode}`}><span>{(roomName || roomCode).slice(0, 2).toUpperCase()}</span></button>
    {rooms.map((room) => <button type="button" className="rail-room" key={room.code} onClick={() => onOpenSwitcher()} title={`${room.name} - ${room.code}`} aria-label={`${room.name} ${room.code}`}><span>{(room.name || room.code).slice(0, 2).toUpperCase()}</span></button>)}
    <div className="rail-divider rail-divider-bottom" />
    <button type="button" className="rail-add" onClick={onOpenSwitcher} title="Entrar ou criar uma sala" aria-label="Entrar ou criar uma sala">+</button>
  </nav>;
}
