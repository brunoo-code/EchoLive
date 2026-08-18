import { useEffect, useRef, useState } from "react";
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
  const [isEditingNickname, setIsEditingNickname] = useState(() => !nickname.trim());
  const [nicknameBeforeEdit, setNicknameBeforeEdit] = useState(nickname);
  const [homeIntent, setHomeIntent] = useState("quick");
  const [ekoMode, setEkoMode] = useState("idle");
  const reactionTimerRef = useRef(null);
  const ekoHoverRef = useRef(null);
  const { toasts, notify } = useToasts();
  const { availability, logout, status, user } = useAuth();

  useEffect(() => {
    const savedNickname = localStorage.getItem(NICKNAME_KEY) || localStorage.getItem("nickname") || "";
    localStorage.setItem(NICKNAME_KEY, savedNickname);
    localStorage.removeItem("nickname");
    localStorage.removeItem("echolive.roomCode");
    setNickname(savedNickname);
    setNicknameBeforeEdit(savedNickname);
    setIsEditingNickname(!savedNickname);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !user || nickname.trim()) return;
    const accountNickname = user.displayName || user.username;
    localStorage.setItem(NICKNAME_KEY, accountNickname);
    localStorage.setItem(LAST_NICKNAME_KEY, accountNickname);
    setNickname(accountNickname);
    setNicknameBeforeEdit(accountNickname);
    setIsEditingNickname(false);
  }, [nickname, status, user]);

  useEffect(() => () => {
    if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
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
    setNicknameBeforeEdit(cleanNickname);
    setIsEditingNickname(false);
    return cleanNickname;
  }

  function startNicknameEdit() {
    setNicknameBeforeEdit(nickname);
    setIsEditingNickname(true);
  }

  function cancelNicknameEdit() {
    setNickname(nicknameBeforeEdit);
    setIsEditingNickname(Boolean(nicknameBeforeEdit.trim()) === false);
  }

  function confirmNicknameEdit() {
    if (nickname.trim()) saveNickname();
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
    changeHomeIntent("quick");
    celebrateEko("quickCelebrate");
    setMode("create");
    window.requestAnimationFrame(() => {
      const targetId = !nickname.trim()
        ? "home-nickname"
        : !roomName.trim()
          ? "home-room-name"
          : !createCode.trim()
            ? "home-create-code"
            : "home-create-room";
      const target = document.getElementById(targetId);
      if (!target) return;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      target.focus({ preventScroll: true });
    });
  }

  function openAccountEntry() {
    changeHomeIntent("account");
    celebrateEko("accountCelebrate");
    setAuthModalMode("register");
  }

  function changeHomeIntent(nextIntent) {
    ekoHoverRef.current = nextIntent;
    setHomeIntent(nextIntent);
    if (!reactionTimerRef.current) setEkoMode(nextIntent);
  }

  function resetEko() {
    ekoHoverRef.current = null;
    if (!reactionTimerRef.current) {
      setEkoMode("idle");
      setHomeIntent("quick");
    }
  }

  function celebrateEko(reaction) {
    if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
    setEkoMode(reaction);
    reactionTimerRef.current = window.setTimeout(() => {
      reactionTimerRef.current = null;
      setEkoMode(ekoHoverRef.current || "idle");
    }, reaction === "accountCelebrate" ? 480 : 620);
  }

  return (
    <main className="page home-page">
      <ToastStack toasts={toasts} />
      <div className="home-shell">
        <header className="home-topbar">
          <div className="home-brand">
            <div className="brand-mark" aria-hidden="true"><BrandMark size={28} /></div>
            <strong className="home-wordmark">EchoLive</strong>
          </div>
          <div className="home-account-bar" aria-label="Conta EchoLive">
            {status === "loading" && <span className="home-account-loading">Verificando conta...</span>}
            {status === "guest" && <>
              <div className="home-account-actions"><button type="button" className="home-account-button" onClick={() => setAuthModalMode("login")}>Entrar</button><button type="button" className="home-account-button is-primary" onClick={openAccountEntry}>Criar conta</button></div>
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
              <h1>Converse do <span>seu jeito.</span></h1>
              <p className="home-subtitle">Entre em uma sala e fale com quem importa.</p>
              <div className="home-capabilities" aria-label="Recursos do EchoLive"><span className="tone-voice"><i><Icon name="voice" size={14} /></i>Voz</span><span className="tone-video"><i><Icon name="video" size={14} /></i>Video</span><span className="tone-screen"><i><Icon name="screen" size={14} /></i>Tela</span><span className="tone-chat"><i><Icon name="chat" size={14} /></i>Chat</span></div>
            </div>

            <section className="home-entry-surface" aria-labelledby="home-entry-title">
              <div className="home-entry-heading"><h2 id="home-entry-title"><i className="home-kicker-dot" aria-hidden="true" />Comece uma conversa</h2><span className={`home-entry-status ${nickname.trim() ? "is-ready" : ""}`}><i aria-hidden="true" />{nickname.trim() ? "Pronto para entrar" : "Escolha seu nome"}</span></div>
              <p className="home-entry-copy"><strong>Entre como visitante.</strong> <span>Sem cadastro.</span></p>
              {nickname.trim() && !isEditingNickname ? <div className="home-identity-preview">
                <span className="home-identity-icon"><BrandMark size={20} /></span>
                <span className="home-identity-copy"><strong>Voce entra como</strong><b>{nickname}</b><small><i className="home-status-dot" aria-hidden="true" />Visitante</small></span>
                <button type="button" className="home-identity-edit" onClick={startNicknameEdit}>Editar</button>
              </div> : <div className="home-identity-row">
                <span className="home-identity-icon"><BrandMark size={20} /></span>
                <span className="home-identity-copy"><strong>Voce vai entrar como</strong><small><i className="home-status-dot is-muted" aria-hidden="true" />Seu nome fica visivel na sala</small></span>
                <label className="home-identity-input">
                  <span className="visually-hidden">Nickname</span>
                  <input id="home-nickname" maxLength={24} autoFocus={isEditingNickname} aria-label="Nickname" placeholder="Como voce quer aparecer?" value={nickname} onChange={(event) => setNickname(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); confirmNicknameEdit(); } if (event.key === "Escape") { event.preventDefault(); cancelNicknameEdit(); } }} />
                </label>
              </div>}

              <div className="home-tabs" role="tablist" aria-label="Entrada na sala">
                <button type="button" className={mode === "create" ? "is-selected" : ""} onClick={() => { setMode("create"); changeHomeIntent("quick"); }} onMouseEnter={() => changeHomeIntent("quick")} onFocus={() => changeHomeIntent("quick")} onMouseLeave={resetEko} onBlur={resetEko}>Criar sala</button>
                <button type="button" className={mode === "join" ? "is-selected" : ""} onClick={() => { setMode("join"); changeHomeIntent("quick"); }} onMouseEnter={() => changeHomeIntent("quick")} onFocus={() => changeHomeIntent("quick")} onMouseLeave={resetEko} onBlur={resetEko}>Entrar com codigo</button>
              </div>
              {mode === "create" && <>
                <label className="field">
                  <span>Nome da sala</span>
                  <input id="home-room-name" maxLength={24} placeholder="Minha sala" value={roomName} onChange={(event) => setRoomName(event.target.value.slice(0, 24))} />
                </label>
                <label className="field">
                  <span>Codigo da sala</span>
                  <div className="home-code-field">
                    <input id="home-create-code" maxLength={9} placeholder="SALA01" value={createCode} onChange={(event) => setCreateCode(normalizeCode(event.target.value))} />
                    <button type="button" onClick={() => setCreateCode(generateCode())} title="Gerar novo codigo" aria-label="Gerar novo codigo"><Icon name="pulse" size={16} /></button>
                  </div>
                </label>
                <button id="home-create-room" className="primary-button home-entry-cta" type="button" onClick={createRoom} onMouseEnter={() => changeHomeIntent("quick")} onFocus={() => changeHomeIntent("quick")} onMouseLeave={resetEko} onBlur={resetEko} disabled={isCreating}><span>{isCreating ? "Criando..." : "Criar sala"}</span><Icon name="voice" size={15} /></button>
              </>}
              {mode === "join" && <div className="join-form">
                <label className="field">
                  <span>Codigo da sala</span>
                  <input maxLength={9} placeholder="SALA01" value={joinCode} onChange={(event) => setJoinCode(normalizeCode(event.target.value))} />
                </label>
                <button className="secondary-button home-entry-cta" type="button" onClick={() => joinRoom({ preventDefault() {} })} onMouseEnter={() => changeHomeIntent("quick")} onFocus={() => changeHomeIntent("quick")} onMouseLeave={resetEko} onBlur={resetEko}><span>Entrar na sala</span><Icon name="link" size={15} /></button>
              </div>}
            </section>

            {recentRooms.length > 0 && <section className="home-recent-surface"><div className="home-section-heading"><span className="section-label">Salas recentes</span><button type="button" className="text-button" onClick={() => { localStorage.removeItem(RECENT_ROOMS_KEY); setRecentRooms([]); }}>Limpar recentes</button></div>{recentRooms.map((room) => <div className="recent-room" key={room.code}><div className="recent-room-avatar" style={{ background: roomColor(room.code) }}>{roomInitials(room.name, room.code)}</div><div><strong title={room.name}>{room.name}</strong><span>{room.code}</span><small>{room.lastVisitedAt ? `Visitada ${new Date(room.lastVisitedAt).toLocaleDateString("pt-BR")}` : "Sala recente"}</small></div><button type="button" className="recent-room-enter" onClick={() => enterRecent(room)}><Icon name="link" size={14} />Entrar</button><button type="button" className="text-button recent-room-remove" onClick={() => removeRecent(room.code)} aria-label={`Remover ${room.name}`}><Icon name="close" size={14} /></button></div>)}</section>}
          </section>

          <aside className="home-aside">
            <EkoGuide
              mode={ekoMode}
              activeIntent={homeIntent}
              onIntentChange={changeHomeIntent}
              onIntentEnd={resetEko}
              onQuickEntry={focusQuickEntry}
              onCreateAccount={openAccountEntry}
            />
          </aside>
        </div>
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
