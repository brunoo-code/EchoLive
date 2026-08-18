import { useState } from "react";

const CODE_PATTERN = /^[A-Z0-9]{3,9}$/;

export default function RoomSwitcherModal({ currentRoomCode, recentRooms, onEnter, onRemove, onClear, onClose }) {
  const [code, setCode] = useState("");
  const [pendingCode, setPendingCode] = useState("");

  function submit(event) {
    event.preventDefault();
    const next = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9);
    if (!CODE_PATTERN.test(next)) return;
    openRoom(next);
  }

  function openRoom(next) {
    if (next === currentRoomCode) return;
    setPendingCode(next);
  }

  function confirmSwitch(newTab) {
    const url = `${window.location.origin}/room/${pendingCode}`;
    if (newTab) window.open(url, "_blank", "noopener,noreferrer");
    else onEnter(pendingCode);
    setPendingCode("");
    onClose();
  }

  return <div className="modal-backdrop" role="presentation">
    <section className="room-switcher-modal" role="dialog" aria-modal="true" aria-labelledby="room-switcher-title">
      <header className="settings-header"><div><p className="section-label">Navegacao</p><h2 id="room-switcher-title">Trocar de sala</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">x</button></header>
      <form className="switcher-form" onSubmit={submit}><label className="field"><span>Codigo da sala</span><input autoFocus maxLength={9} placeholder="SALA01" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9))} /></label><button className="primary-button" type="submit">Entrar</button></form>
      <div className="recent-rooms switcher-recent"><div className="home-section-heading"><span className="section-label">Salas recentes</span>{recentRooms.length > 0 && <button type="button" className="text-button" onClick={onClear}>Limpar recentes</button>}</div>{recentRooms.length === 0 && <p className="status-line">Nenhuma sala recente.</p>}{recentRooms.map((room) => <div className="recent-room" key={room.code}><div><strong title={room.name}>{room.name}</strong><span>{room.code}</span></div><button type="button" onClick={() => openRoom(room.code)}>Entrar</button><button type="button" className="text-button" onClick={() => onRemove(room.code)} aria-label={`Remover ${room.name}`}>x</button></div>)}</div>
      <button type="button" className="ghost-button" onClick={() => { onClose(); window.location.assign("/"); }}>Criar nova sala</button>
      {pendingCode && <div className="switcher-confirm"><strong>Voce ja esta em uma sala.</strong><p>Escolha como abrir {pendingCode}.</p><div className="modal-actions"><button type="button" className="primary-button" onClick={() => confirmSwitch(false)}>Trocar de sala</button><button type="button" className="secondary-button" onClick={() => confirmSwitch(true)}>Abrir em nova aba</button><button type="button" className="ghost-button" onClick={() => setPendingCode("")}>Cancelar</button></div></div>}
    </section>
  </div>;
}
