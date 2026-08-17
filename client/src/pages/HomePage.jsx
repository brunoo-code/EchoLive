import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import ToastStack from "../components/ToastStack.jsx";
import useToasts from "../hooks/useToasts.js";
import { SERVER_URL } from "../utils/webrtc.js";

const NICKNAME_KEY = "echolive.nickname";
const ROOM_CODE_PATTERN = /^[A-Z0-9_-]{3,16}$/;
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 16);
}

function generateCode() {
  return Array.from({ length: 6 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join("");
}

export default function HomePage({ onRoomCreated }) {
  const [nickname, setNickname] = useState("");
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
    setNickname(cleanNickname);
    return cleanNickname;
  }

  function createRoom() {
    const cleanNickname = saveNickname();
    const cleanCode = normalizeCode(createCode.trim());
    const rawName = roomName.trim();
    const cleanName = rawName.slice(0, 32);

    if (!cleanNickname || !ROOM_CODE_PATTERN.test(cleanCode)) {
      notify("Use um codigo de sala entre 3 e 16 caracteres, com letras, numeros, - ou _.");
      return;
    }

    if (rawName.length > 32 || /[<>]/.test(rawName)) {
      notify("O nome da sala deve ter ate 32 caracteres e nao conter HTML.");
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

    onRoomCreated(cleanRoomCode);
  }

  return (
    <main className="page home-page">
      <ToastStack toasts={toasts} />
      <section className="home-panel home-panel-wide">
        <div className="home-brand">
          <div className="brand-mark" aria-hidden="true">EL</div>
          <div><p className="eyebrow">EchoLive</p><h1>EchoLive</h1></div>
        </div>
        <p className="home-subtitle">Sua sala privada de voz, video e tela.</p>
        <p className="home-copy">Escolha um nome e um codigo para criar sua sala.</p>

        <label className="field">
          <span>Nickname</span>
          <input maxLength={24} placeholder="Como voce quer aparecer?" value={nickname} onChange={(event) => setNickname(event.target.value)} />
        </label>

        <div className="home-section-heading"><span className="section-label">Criar nova sala</span><small>Defina um nome e um codigo simples.</small></div>
        <label className="field">
          <span>Nome da sala</span>
          <input maxLength={32} placeholder="Minha sala" value={roomName} onChange={(event) => setRoomName(event.target.value)} />
        </label>
        <label className="field">
          <span>Codigo da sala</span>
          <div className="code-input-row">
            <input maxLength={16} placeholder="SALA01" value={createCode} onChange={(event) => setCreateCode(normalizeCode(event.target.value))} />
            <button type="button" className="small-button" onClick={() => setCreateCode(generateCode())}>Gerar codigo</button>
          </div>
        </label>
        <button className="primary-button" type="button" onClick={createRoom} disabled={isCreating}>{isCreating ? "Criando..." : "Criar sala"}</button>

        <div className="form-separator"><span>Entre em uma sala existente usando o codigo.</span></div>
        <form className="join-form" onSubmit={joinRoom}>
          <label className="field">
            <span>Codigo da sala</span>
            <input maxLength={16} placeholder="Digite o codigo" value={joinCode} onChange={(event) => setJoinCode(normalizeCode(event.target.value))} />
          </label>
          <button className="secondary-button" type="submit">Entrar na sala</button>
        </form>
      </section>
    </main>
  );
}
