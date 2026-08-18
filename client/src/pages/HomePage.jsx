import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import ToastStack from "../components/ToastStack.jsx";
import useToasts from "../hooks/useToasts.js";
import { SERVER_URL } from "../utils/webrtc.js";
import BrandMark from "../components/BrandMark.jsx";

const NICKNAME_KEY = "echolive.nickname";
const LAST_NICKNAME_KEY = "echolive.lastNickname";
const RECENT_ROOMS_KEY = "echolive.recentRooms";
const ROOM_CODE_PATTERN = /^[A-Z0-9]{3,9}$/;
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 16);
}

function generateCode() {
  return Array.from({ length: 6 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join("");
}

export default function HomePage({ onRoomCreated }) {
  const [nickname, setNickname] = useState(() => localStorage.getItem(LAST_NICKNAME_KEY) || localStorage.getItem(NICKNAME_KEY) || "");
  const [mode, setMode] = useState("create");
  const [recentRooms, setRecentRooms] = useState(() => readRecentRooms());
  const [roomName, setRoomName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { toasts, notify } = useToasts();

  useEffect(() => {
    const savedNickname = localStorage.getItem(NICKNAME_KEY) || localStorage.getItem("nickname") || "";
    localStorage.setItem(NICKNAME_KEY, savedNickname);
    localStorage.removeItem("nickname");
    localStorage.removeItem("echolive.roomCode");
    setNickname(savedNickname);
  }, []);

  function saveNickname() {
    const cleanNickname = nickname.trim().slice(0, 24);

    if (!cleanNickname) {
      notify("Informe um nickname.");
      return null;
    }

    localStorage.setItem(NICKNAME_KEY, cleanNickname);
    localStorage.setItem(LAST_NICKNAME_KEY, cleanNickname);
    setNickname(cleanNickname);
    return cleanNickname;
  }

  function createRoom() {
    const cleanNickname = saveNickname();
    const cleanCode = normalizeCode(createCode.trim());
    const rawName = roomName.trim();
    const cleanName = rawName.slice(0, 24);

    if (!cleanNickname || !ROOM_CODE_PATTERN.test(cleanCode)) {
      notify("Use um codigo de sala entre 3 e 9 caracteres, com letras e numeros.");
      return;
    }

    if (!cleanName || rawName.length > 24 || /[<>]/.test(rawName)) {
      notify("O nome da sala pode ter no maximo 24 caracteres.");
      return;
    }

    setIsCreating(true);
    const socket = io(SERVER_URL);

    socket.on("connect", () => {
      socket.emit("create-room", { nickname: cleanNickname, roomCode: cleanCode, roomName: cleanName });
    });

    socket.on("room-created", ({ roomCode: createdRoomCode }) => {
      socket.disconnect();
      setIsCreating(false);
      saveRecentRoom(createdRoomCode, cleanName, setRecentRooms);
      onRoomCreated(createdRoomCode);
    });

    socket.on("room-error", ({ message }) => {
      notify(message);
      socket.disconnect();
      setIsCreating(false);
    });

    socket.on("connect_error", () => {
      notify("Erro de conexao. Verifique se o servidor esta rodando.");
      socket.disconnect();
      setIsCreating(false);
    });
  }

  function joinRoom(event) {
    event.preventDefault();
    const cleanNickname = saveNickname();
    const cleanRoomCode = normalizeCode(joinCode.trim());

    if (!cleanNickname) return;
    if (!ROOM_CODE_PATTERN.test(cleanRoomCode)) {
      notify("Informe um codigo de sala valido.");
      return;
    }

    saveRecentRoom(cleanRoomCode, `Sala ${cleanRoomCode}`, setRecentRooms);
    onRoomCreated(cleanRoomCode);
  }

  function removeRecent(code) {
    const next = recentRooms.filter((room) => room.code !== code);
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(next));
    setRecentRooms(next);
  }

  function enterRecent(room) {
    saveNickname();
    saveRecentRoom(room.code, room.name, setRecentRooms);
    onRoomCreated(room.code);
  }

  return (
    <main className="page home-page">
      <ToastStack toasts={toasts} />
      <section className="home-panel home-panel-wide">
        <div className="home-brand">
          <div className="brand-mark" aria-hidden="true"><BrandMark size={30} /></div>
          <div><p className="eyebrow">EchoLive</p><h1>EchoLive</h1></div>
        </div>
        <p className="home-subtitle">Converse. Compartilhe. Continue conectado.</p>
        <p className="home-copy">Voz, video, tela e chat direto no navegador.</p>
        <div className="home-capabilities" aria-label="Recursos do EchoLive"><span><i>V</i>Voz</span><span><i>C</i>Video</span><span><i>T</i>Tela</span><span><i>#</i>Chat</span></div>

        <label className="field">
          <span>Nickname</span>
          <input maxLength={24} placeholder="Como voce quer aparecer?" value={nickname} onChange={(event) => setNickname(event.target.value)} />
        </label>

        <div className="home-tabs" role="tablist" aria-label="Entrada na sala">
          <button type="button" className={mode === "create" ? "is-selected" : ""} onClick={() => setMode("create")}>Criar sala</button>
          <button type="button" className={mode === "join" ? "is-selected" : ""} onClick={() => setMode("join")}>Entrar em sala</button>
        </div>
        {mode === "create" && <>
        <div className="home-section-heading"><span className="section-label">Criar nova sala</span><small>Defina um nome e um codigo simples.</small></div>
        <label className="field">
          <span>Nome da sala</span>
          <input maxLength={24} placeholder="Minha sala" value={roomName} onChange={(event) => setRoomName(event.target.value.slice(0, 24))} />
        </label>
        <label className="field">
          <span>Codigo da sala</span>
          <div className="code-input-row">
            <input maxLength={9} placeholder="SALA01" value={createCode} onChange={(event) => setCreateCode(normalizeCode(event.target.value))} />
            <button type="button" className="small-button" onClick={() => setCreateCode(generateCode())} title="Gerar novo codigo" aria-label="Gerar novo codigo">↻ <span>Gerar codigo</span></button>
          </div>
        </label>
        <button className="primary-button" type="button" onClick={createRoom} disabled={isCreating}>{isCreating ? "Criando..." : "Criar sala"}</button>
        </>}
        {mode === "join" && <div className="join-form">
        <div className="home-section-heading"><span className="section-label">Entrar em uma sala</span><small>Use o codigo compartilhado com voce.</small></div>
          <label className="field">
            <span>Codigo da sala</span>
            <input maxLength={9} placeholder="SALA01" value={joinCode} onChange={(event) => setJoinCode(normalizeCode(event.target.value))} />
          </label>
          <button className="secondary-button" type="button" onClick={() => joinRoom({ preventDefault() {} })}>Entrar na sala</button>
        </div>}
        {recentRooms.length > 0 && <section className="recent-rooms"><div className="home-section-heading"><span className="section-label">Salas recentes</span><button type="button" className="text-button" onClick={() => { localStorage.removeItem(RECENT_ROOMS_KEY); setRecentRooms([]); }}>Limpar recentes</button></div>{recentRooms.map((room) => <div className="recent-room" key={room.code}><div className="recent-room-avatar" style={{ background: roomColor(room.code) }}>{roomInitials(room.name, room.code)}</div><div><strong title={room.name}>{room.name}</strong><span>{room.code}</span><small>{room.lastVisitedAt ? `Visitada ${new Date(room.lastVisitedAt).toLocaleDateString("pt-BR")}` : "Sala recente"}</small></div><button type="button" onClick={() => enterRecent(room)}>Entrar</button><button type="button" className="text-button" onClick={() => removeRecent(room.code)} aria-label={`Remover ${room.name}`}>x</button></div>)}</section>}
        <p className="home-footnote">Sem cadastro - Salas temporarias - Direto no navegador</p>
      </section>
    </main>
  );
}

function readRecentRooms() {
  try { return JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || "[]").filter((room) => /^[A-Z0-9]{3,9}$/.test(room.code)).slice(0, 10); } catch { return []; }
}

function saveRecentRoom(code, name, setState) {
  const current = readRecentRooms().filter((room) => room.code !== code);
  const next = [{ code, name: String(name || `Sala ${code}`).slice(0, 24), lastVisitedAt: Date.now() }, ...current].slice(0, 10);
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(next));
  setState(next);
}

function roomInitials(name, code) { return String(name || code).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase().slice(0, 2); }
function roomColor(code) { let hash = 0; for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) % 360; return `hsl(${hash} 62% 42%)`; }
