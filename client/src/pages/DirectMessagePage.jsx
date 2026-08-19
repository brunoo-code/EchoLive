import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import SocialRail from "../components/SocialRail.jsx";
import SocialSidebar, { Avatar } from "../components/SocialSidebar.jsx";
import SocialEmptyState from "../components/SocialEmptyState.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useSocial } from "../social/SocialContext.jsx";

export default function DirectMessagePage({ conversationId, onNavigateHome, onNavigateFriends, onNavigateDm }) {
  const { user } = useAuth();
  const { conversations, onlineUserIds, socket, socketReady, loadMessages, markRead, socialStatus } = useSocial();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationReady, setConversationReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const bottomRef = useRef(null);
  const composerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const conversation = conversations.find((item) => item.id === conversationId);
  const otherUser = conversation?.user;
  const isOnline = Boolean(otherUser && onlineUserIds.has(otherUser.id));

  useEffect(() => {
    if (!conversationId || !otherUser || !socket || !socketReady) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    setMessages([]);
    setConversationReady(false);
    setLoadFailed(false);
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
    socket.emit("dm:join", { conversationId }, (result) => {
      if (!active) return;
      if (!result?.ok) {
        setError(result?.error || "Conversa indisponivel.");
        setLoadFailed(true);
        setLoading(false);
        return;
      }
      setConversationReady(true);
      loadMessages(conversationId).then((data) => {
        if (!active) return;
        setMessages(data.messages || []);
        setHasMore(Boolean(data.hasMore));
        setLoading(false);
        markRead(conversationId).catch(() => {});
      }).catch((requestError) => {
        if (active) { setError(requestError.message); setLoadFailed(true); setLoading(false); }
      });
    });
    return () => {
      active = false;
      window.clearTimeout(typingTimerRef.current);
      socket.emit("dm:leave", { conversationId });
      setConversationReady(false);
      socket.off("dm:new-message", handleMessage);
      socket.off("dm:typing", handleTyping);
    };
  }, [conversationId, loadMessages, markRead, otherUser?.id, retryVersion, socket, socketReady, user?.id]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [text]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleTypingInput(value) {
    setText(value.slice(0, 4000));
    if (!socket || !conversationId || !conversationReady) return;
    socket.emit("dm:typing", { conversationId, typing: true });
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => socket.emit("dm:typing", { conversationId, typing: false }), 1200);
  }

  function sendMessage(event) {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || sending || !socket || !conversationReady) return;
    setSending(true);
    socket.emit("dm:message", { conversationId, content: cleanText }, (result) => {
      setSending(false);
      if (!result?.ok) { setError(result?.error || "Nao foi possivel enviar a mensagem."); return; }
      setText("");
      socket.emit("dm:typing", { conversationId, typing: false });
    });
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(event);
    }
  }

  async function loadOlder() {
    const first = messages[0];
    if (!first || !hasMore) return;
    const data = await loadMessages(conversationId, first.createdAt);
    setMessages((current) => [...(data.messages || []), ...current]);
    setHasMore(Boolean(data.hasMore));
  }

  if (!otherUser && socialStatus !== "ready" && socialStatus !== "error") return <main className="page social-page"><SocialRail onHome={onNavigateHome} /><SocialSidebar activeTab="friends" onTabChange={onNavigateFriends} conversations={conversations} onlineUserIds={onlineUserIds} user={user} onHome={onNavigateHome} onOpenConversation={onNavigateDm} activeConversationId={conversationId} /><section className="dm-content"><SocialEmptyState title="Abrindo conversa..." copy="Estamos recuperando suas mensagens." /></section></main>;
  if (!otherUser) return <main className="page social-page"><SocialRail onHome={onNavigateHome} /><SocialSidebar activeTab="friends" onTabChange={onNavigateFriends} conversations={conversations} onlineUserIds={onlineUserIds} user={user} onHome={onNavigateHome} onOpenConversation={onNavigateDm} activeConversationId={conversationId} /><section className="dm-content"><SocialEmptyState title="Conversa indisponivel" copy="Escolha uma conversa existente para continuar." action="Voltar para Amigos" onAction={onNavigateFriends} /></section></main>;

  return <main className="page social-page"><SocialRail onHome={onNavigateHome} /><SocialSidebar activeTab="friends" onTabChange={onNavigateFriends} conversations={conversations} onlineUserIds={onlineUserIds} user={user} onHome={onNavigateHome} onOpenConversation={onNavigateDm} activeConversationId={conversationId} /><section className="dm-content"><header className="dm-header"><Avatar user={otherUser} size={38} /><div><strong>{otherUser.displayName || otherUser.username}</strong><small>@{otherUser.username} · {isOnline ? "Online" : "Offline"}</small></div><span className={isOnline ? "dm-status is-online" : "dm-status"}>{isOnline ? "Online" : "Offline"}</span></header><div className="dm-messages">{hasMore && <button type="button" className="text-button dm-load-more" onClick={loadOlder}>Carregar mensagens anteriores</button>}{loading ? <p className="dm-loading">Conectando a conversa...</p> : loadFailed ? <div className="dm-load-error"><strong>Nao foi possivel carregar esta conversa.</strong><span>{error || "Tente novamente."}</span><button type="button" className="secondary-button" onClick={() => { setError(""); setRetryVersion((value) => value + 1); }}>Tentar novamente</button></div> : messages.length ? messages.map((message, index) => <Message key={message.id} message={message} mine={message.senderUserId === user.id} compact={index > 0 && messages[index - 1].senderUserId === message.senderUserId} />) : <div className="dm-intro"><Avatar user={otherUser} size={76} /><h2>{otherUser.displayName || otherUser.username}</h2><p>@{otherUser.username}</p><span>Este e o comeco da sua conversa.</span></div>}<div className={`dm-typing ${typing ? "is-visible" : ""}`} aria-live="polite"><i /><i /><i /> {otherUser.displayName || otherUser.username} esta digitando</div><div ref={bottomRef} /></div>{error && !loadFailed && <p className="social-feedback is-error dm-error">{error}</p>}<form className="dm-composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="dm-message">Mensagem</label><textarea ref={composerRef} id="dm-message" value={text} onChange={(event) => handleTypingInput(event.target.value)} onKeyDown={handleComposerKeyDown} maxLength={4000} rows={1} placeholder={`Conversar com ${otherUser.displayName || otherUser.username}`} disabled={!conversationReady} /><button type="submit" className="primary-button" disabled={!text.trim() || sending || !conversationReady} aria-label="Enviar mensagem"><Icon name="send" size={16} /></button></form></section></main>;
}

function Message({ message, mine, compact }) {
  return <article className={`dm-message ${mine ? "is-mine" : ""} ${compact ? "is-compact" : ""}`}><div className="dm-message-avatar">{!compact && <Avatar user={message.sender} size={32} />}</div><div><div className="dm-message-meta">{!compact && <strong>{message.sender.displayName || message.sender.username}</strong>}<small>{formatMessageTime(message.createdAt)}</small></div><p>{message.content}</p></div></article>;
}

function formatMessageTime(value) {
  try { return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
