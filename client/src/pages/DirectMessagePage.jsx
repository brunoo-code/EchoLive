import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import SocialSidebar, { Avatar } from "../components/SocialSidebar.jsx";
import SocialEmptyState from "../components/SocialEmptyState.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useSocial } from "../social/SocialContext.jsx";

export default function DirectMessagePage({ conversationId, onNavigateHome, onNavigateFriends, onNavigateDm }) {
  const { user } = useAuth();
  const { conversations, onlineUserIds, socket, loadMessages, markRead, socialStatus } = useSocial();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);
  const conversation = conversations.find((item) => item.id === conversationId);
  const otherUser = conversation?.user;
  const isOnline = Boolean(otherUser && onlineUserIds.has(otherUser.id));

  useEffect(() => {
    if (!conversationId || !socket) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    setMessages([]);
    socket.emit("dm:join", { conversationId }, (result) => {
      if (!active) return;
      if (!result?.ok) {
        setError(result?.error || "Conversa indisponivel.");
        setLoading(false);
        return;
      }
      loadMessages(conversationId).then((data) => {
        if (!active) return;
        setMessages(data.messages || []);
        setHasMore(Boolean(data.hasMore));
        setLoading(false);
        markRead(conversationId).catch(() => {});
      }).catch((requestError) => {
        if (active) { setError(requestError.message); setLoading(false); }
      });
    });
    const handleMessage = (message) => {
      if (message.conversationId !== conversationId) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      markRead(conversationId).catch(() => {});
    };
    const handleTyping = (payload) => {
      if (payload?.conversationId === conversationId && payload.userId !== user?.id) setTyping(Boolean(payload.typing));
    };
    socket.on("dm:new-message", handleMessage);
    socket.on("dm:typing", handleTyping);
    return () => {
      active = false;
      socket.emit("dm:leave", { conversationId });
      socket.off("dm:new-message", handleMessage);
      socket.off("dm:typing", handleTyping);
    };
  }, [conversationId, loadMessages, markRead, socket, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleTypingInput(value) {
    setText(value.slice(0, 4000));
    if (!socket || !conversationId) return;
    socket.emit("dm:typing", { conversationId, typing: true });
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => socket.emit("dm:typing", { conversationId, typing: false }), 1200);
  }

  function sendMessage(event) {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || sending || !socket) return;
    setSending(true);
    socket.emit("dm:message", { conversationId, content: cleanText }, (result) => {
      setSending(false);
      if (!result?.ok) { setError(result?.error || "Nao foi possivel enviar a mensagem."); return; }
      setText("");
      socket.emit("dm:typing", { conversationId, typing: false });
    });
  }

  async function loadOlder() {
    const first = messages[0];
    if (!first || !hasMore) return;
    const data = await loadMessages(conversationId, first.createdAt);
    setMessages((current) => [...(data.messages || []), ...current]);
    setHasMore(Boolean(data.hasMore));
  }

  if (!otherUser && socialStatus !== "ready" && socialStatus !== "error") return <main className="page social-page"><SocialSidebar activeTab="friends" onTabChange={onNavigateFriends} conversations={conversations} onlineUserIds={onlineUserIds} user={user} onHome={onNavigateHome} onOpenConversation={onNavigateDm} /><section className="dm-content"><SocialEmptyState title="Abrindo conversa..." copy="Estamos recuperando suas mensagens." /></section></main>;
  if (!otherUser) return <main className="page social-page"><SocialSidebar activeTab="friends" onTabChange={onNavigateFriends} conversations={conversations} onlineUserIds={onlineUserIds} user={user} onHome={onNavigateHome} onOpenConversation={onNavigateDm} /><section className="dm-content"><SocialEmptyState title="Conversa indisponivel" copy="Escolha uma conversa existente para continuar." action="Voltar para Amigos" onAction={onNavigateFriends} /></section></main>;

  return <main className="page social-page"><SocialSidebar activeTab="friends" onTabChange={onNavigateFriends} conversations={conversations} onlineUserIds={onlineUserIds} user={user} onHome={onNavigateHome} onOpenConversation={onNavigateDm} /><section className="dm-content"><header className="dm-header"><Avatar user={otherUser} size={38} /><div><strong>{otherUser.displayName || otherUser.username}</strong><small>@{otherUser.username} · {isOnline ? "Online" : "Offline"}</small></div><span className={isOnline ? "dm-status is-online" : "dm-status"}>{isOnline ? "Online" : "Offline"}</span></header><div className="dm-messages">{hasMore && <button type="button" className="text-button dm-load-more" onClick={loadOlder}>Carregar mensagens anteriores</button>}{loading ? <p className="dm-loading">Carregando conversa...</p> : messages.length ? messages.map((message) => <Message key={message.id} message={message} mine={message.senderUserId === user.id} />) : <div className="dm-intro"><Avatar user={otherUser} size={76} /><h2>{otherUser.displayName || otherUser.username}</h2><p>@{otherUser.username}</p><span>Este e o comeco da sua conversa.</span></div>}{typing && <div className="dm-typing"><i /><i /><i /> {otherUser.displayName || otherUser.username} esta digitando</div>}<div ref={bottomRef} /></div>{error && <p className="social-feedback is-error dm-error">{error}</p>}<form className="dm-composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="dm-message">Mensagem</label><input id="dm-message" value={text} onChange={(event) => handleTypingInput(event.target.value)} maxLength={4000} placeholder={`Conversar com ${otherUser.displayName || otherUser.username}`} /><button type="submit" className="primary-button" disabled={!text.trim() || sending} aria-label="Enviar mensagem"><Icon name="link" size={16} /></button></form></section></main>;
}

function Message({ message, mine }) {
  return <article className={`dm-message ${mine ? "is-mine" : ""}`}><div className="dm-message-avatar"><Avatar user={message.sender} size={32} /></div><div><div className="dm-message-meta"><strong>{message.sender.displayName || message.sender.username}</strong><small>{formatMessageTime(message.createdAt)}</small></div><p>{message.content}</p></div></article>;
}

function formatMessageTime(value) {
  try { return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
