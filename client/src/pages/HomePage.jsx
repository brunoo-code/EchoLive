import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import ToastStack from "../components/ToastStack.jsx";
import useToasts from "../hooks/useToasts.js";
import { SERVER_URL } from "../utils/webrtc.js";
import BrandMark from "../components/BrandMark.jsx";
import Icon from "../components/Icon.jsx";
import AuthModal from "../components/AuthModal.jsx";
import EkoGuide from "../components/EkoGuide.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

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
  const [authModalMode, setAuthModalMode] = useState(null);
  const [homeIntent, setHomeIntent] = useState("quick");
  const { toasts, notify } = useToasts();
  const { availability, logout, status, user } = useAuth();

  useEffect(() => {
    const savedNickname = localStorage.getItem(NICKNAME_KEY) || localStorage.getItem("nickname") || "";
    localStorage.setItem(NICKNAME_KEY, savedNickname);
    localStorage.removeItem("nickname");
    localStorage.removeItem("echolive.roomCode");
    setNickname(savedNickname);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !user || nickname.trim()) return;
    const accountNickname = user.displayName || user.username;
    localStorage.setItem(NICKNAME_KEY, accountNickname);
    localStorage.setItem(LAST_NICKNAME_KEY, accountNickname);
    setNickname(accountNickname);
  }, [nickname, status, user]);

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
    if (!cleanNickname) return;

    const cleanCode = normalizeCode(createCode.trim());
    const rawName = roomName.trim();
    const cleanName = rawName.slice(0, 24);

    if (!ROOM_CODE_PATTERN.test(cleanCode)) {
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

  function focusQuickEntry() {
    setHomeIntent("quick");
    setMode("create");
    document.getElementById("home-entry-title")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function openAccountEntry() {
    setHomeIntent("account");
    setAuthModalMode("register");
  }

  return (
    <main className="page home-page">
      <ToastStack toasts={toasts} />
      <div className="home-shell">
        <header className="home-topbar">
          <div className="home-brand">
            <div className="brand-mark" aria-hidden="true"><BrandMark size={28} /></div>
            <div><p className="eyebrow">Espaco de conversa</p><strong className="home-wordmark">EchoLive</strong></div>
          </div>
          <div className="home-account-bar" aria-label="Conta EchoLive">
            {status === "loading" && <span className="home-account-loading">Verificando conta...</span>}
            {status === "guest" && <>
              <span className="home-account-hint">Entre para continuar de onde parou.</span>
              <div className="home-account-actions"><button type="button" className="home-account-button" onClick={() => setAuthModalMode("login")}>Entrar</button><button type="button" className="home-account-button is-primary" onClick={() => setAuthModalMode("register")}>Criar conta</button></div>
              {availability === "unavailable" && <small>Contas indisponiveis no momento</small>}
            </>}
            {status === "authenticated" && user && <>
              <div className="home-account-identity"><div className="home-account-avatar">{(user.displayName || user.username).slice(0, 1).toUpperCase()}</div><span><strong>{user.displayName}</strong><small>@{user.username}</small></span></div>
              <button type="button" className="home-account-button" onClick={() => logout()}>Sair</button>
            </>}
          </div>
        </header>

        <div className="home-workspace">
          <section className="home-main-column">
            <div className="home-hero">
              <p className="eyebrow">Um lugar para se encontrar</p>
              <h1>Converse do seu jeito.</h1>
              <p className="home-subtitle">Entre em uma sala e fale com quem importa.</p>
              <div className="home-capabilities" aria-label="Recursos do EchoLive"><span><i><Icon name="voice" size={14} /></i>Voz</span><span><i><Icon name="video" size={14} /></i>Video</span><span><i><Icon name="screen" size={14} /></i>Tela</span><span><i><Icon name="chat" size={14} /></i>Chat</span></div>
            </div>

            <section className="home-entry-surface" aria-labelledby="home-entry-title">
              <div className="home-entry-heading"><div><span className="section-label">Entrada rapida</span><h2 id="home-entry-title">Comece uma conversa</h2></div><span className="home-visitor-badge"><i />Visitante</span></div>
              <p className="home-entry-copy">Sem cadastro. Voce pode criar sua identidade agora.</p>
              <div className="home-identity-row">
                <span className="home-identity-icon"><Icon name="account" size={18} /></span>
                <span className="home-identity-copy"><strong>Voce vai entrar como</strong><small>Seu nome fica visivel na sala</small></span>
                <label className="home-identity-input">
                  <span className="visually-hidden">Nickname</span>
                  <input maxLength={24} aria-label="Nickname" placeholder="Como voce quer aparecer?" value={nickname} onChange={(event) => setNickname(event.target.value)} />
                </label>
              </div>

              <div className="home-tabs" role="tablist" aria-label="Entrada na sala">
                <button type="button" className={mode === "create" ? "is-selected" : ""} onClick={() => { setMode("create"); setHomeIntent("quick"); }}>Criar sala</button>
                <button type="button" className={mode === "join" ? "is-selected" : ""} onClick={() => { setMode("join"); setHomeIntent("quick"); }}>Entrar com codigo</button>
              </div>
              {mode === "create" && <>
                <div className="home-section-heading"><span className="section-label">Nova sala</span></div>
                <label className="field">
                  <span>Nome da sala</span>
                  <input maxLength={24} placeholder="Minha sala" value={roomName} onChange={(event) => setRoomName(event.target.value.slice(0, 24))} />
                </label>
                <label className="field">
                  <span>Codigo da sala</span>
                  <div className="home-code-field">
                    <input maxLength={9} placeholder="SALA01" value={createCode} onChange={(event) => setCreateCode(normalizeCode(event.target.value))} />
                    <button type="button" onClick={() => setCreateCode(generateCode())} title="Gerar novo codigo" aria-label="Gerar novo codigo"><Icon name="pulse" size={16} /></button>
                  </div>
                </label>
                <button className="primary-button home-entry-cta" type="button" onClick={createRoom} disabled={isCreating}>{isCreating ? "Criando..." : "Criar sala"}</button>
              </>}
              {mode === "join" && <div className="join-form">
                <div className="home-section-heading"><span className="section-label">Sala existente</span></div>
                <label className="field">
                  <span>Codigo da sala</span>
                  <input maxLength={9} placeholder="SALA01" value={joinCode} onChange={(event) => setJoinCode(normalizeCode(event.target.value))} />
                </label>
                <button className="secondary-button home-entry-cta" type="button" onClick={() => joinRoom({ preventDefault() {} })}>Entrar na sala</button>
              </div>}
            </section>
            <div className="home-account-prompt"><span>Quer manter seu perfil e amigos?</span><button type="button" onClick={openAccountEntry}>Criar conta <span aria-hidden="true">&rarr;</span></button></div>

            {recentRooms.length > 0 && <section className="home-recent-surface"><div className="home-section-heading"><span className="section-label">Salas recentes</span><button type="button" className="text-button" onClick={() => { localStorage.removeItem(RECENT_ROOMS_KEY); setRecentRooms([]); }}>Limpar recentes</button></div>{recentRooms.map((room) => <div className="recent-room" key={room.code}><div className="recent-room-avatar" style={{ background: roomColor(room.code) }}>{roomInitials(room.name, room.code)}</div><div><strong title={room.name}>{room.name}</strong><span>{room.code}</span><small>{room.lastVisitedAt ? `Visitada ${new Date(room.lastVisitedAt).toLocaleDateString("pt-BR")}` : "Sala recente"}</small></div><button type="button" className="recent-room-enter" onClick={() => enterRecent(room)}><Icon name="link" size={14} />Entrar</button><button type="button" className="text-button recent-room-remove" onClick={() => removeRecent(room.code)} aria-label={`Remover ${room.name}`}><Icon name="close" size={14} /></button></div>)}</section>}
          </section>

          <aside className="home-aside">
            <EkoGuide
              state="normal"
              intent={homeIntent}
              onIntentChange={setHomeIntent}
              onQuickEntry={focusQuickEntry}
              onCreateAccount={openAccountEntry}
            />
          </aside>
        </div>
        <footer className="home-footer"><span>EchoLive</span><span>Salas temporarias para conversar agora.</span></footer>
      </div>
      <AuthModal open={Boolean(authModalMode)} initialMode={authModalMode || "login"} onClose={() => setAuthModalMode(null)} />
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
