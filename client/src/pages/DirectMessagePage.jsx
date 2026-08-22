/* SPDX-License-Identifier: AGPL-3.0-or-later. DM presentation directly derived from Fluxer direct-message list surfaces. */
import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import SocialRail from "../components/SocialRail.jsx";
import SocialSidebar, { Avatar } from "../components/SocialSidebar.jsx";
import SocialEmptyState from "../components/SocialEmptyState.jsx";
import EmojiPicker from "../components/EmojiPicker.jsx";
import SocialUserProfileModal from "../components/SocialUserProfileModal.jsx";
import SocialUserProfilePopover from "../components/SocialUserProfilePopover.jsx";
import ProfilePopover from "../components/ProfilePopover.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useSocial } from "../social/SocialContext.jsx";
import { SERVER_URL } from "../utils/webrtc.js";
import { UPLOAD_MIME_TYPES, validateUploadFile } from "../utils/uploadLimits.js";
import { linkifyMessage } from "../utils/linkifyMessage.js";
import { playUiSound } from "../utils/uiSounds.js";
import { publicPresence } from "../utils/presence.js";

const MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
const FILE_ACCEPT = "application/pdf,application/zip,text/plain,application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint,.docx,.xlsx,.pptx";

function uiSoundsEnabled() {
  try {
    return window.localStorage.getItem("echolive.uiSounds") !== "false";
  } catch {
    return true;
  }
}

export default function DirectMessagePage({ conversationId, initialConversation, onNavigateHome, onNavigateFriends, onNavigateDm, onOpenAccountSettings }) {
  const { user, logout, updateProfile } = useAuth();
  const { conversations, onlineUserIds, socket, socialReady, loadMessages, markRead, socialStatus, hideConversation, notificationCount } = useSocial();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [historyStatus, setHistoryStatus] = useState("loading");
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("offline");
  const [realtimeError, setRealtimeError] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationReady, setConversationReady] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(null);
  const [profilePopover, setProfilePopover] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const composerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const listedConversation = conversations.find((item) => item.id === conversationId) || null;
  const [conversationSnapshot, setConversationSnapshot] = useState(() => initialConversation?.id === conversationId ? initialConversation : null);
  const officialFirstOpenRef = useRef(false);
  const draftKey = conversationId ? `echolive.dmDrafts.${conversationId}` : "";
  useEffect(() => {
    if (listedConversation) setConversationSnapshot(listedConversation);
  }, [listedConversation]);
  useEffect(() => {
    if (initialConversation?.id === conversationId) setConversationSnapshot(initialConversation);
  }, [conversationId, initialConversation]);

  useEffect(() => {
    if (!draftKey) return;
    try { setText(localStorage.getItem(draftKey) || ""); } catch { setText(""); }
  }, [draftKey]);
  const conversation = listedConversation || (conversationSnapshot?.id === conversationId ? conversationSnapshot : null);
  const otherUser = conversation?.user;
  const isOfficial = Boolean(otherUser?.isOfficial);
  const isOnline = Boolean(otherUser && onlineUserIds.has(otherUser.id));
  const conversationStatus = otherUser ? "ready" : socialStatus === "error" ? "error" : "loading";

  useEffect(() => {
    if (!lightboxImage) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setLightboxImage(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [lightboxImage]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug("[DM:init]", { conversationId, userId: user?.id || null });
  }, [conversationId, user?.id]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug("[DM:conversation]", { found: Boolean(otherUser), id: conversation?.id || null });
  }, [conversation?.id, otherUser]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug("[DM:render-state]", {
      conversationStatus,
      historyStatus,
      realtimeStatus,
      messageCount: messages.length
    });
  }, [conversationStatus, historyStatus, messages.length, realtimeStatus]);

  useEffect(() => {
    if (!import.meta.env.DEV || !isOfficial) return;
    console.debug("[OFFICIAL:render]", {
      path: window.location.pathname,
      conversationId,
      conversationFound: Boolean(conversation),
      historyStatus,
      messageCount: messages.length,
      officialKeys: messages.map((message) => message.officialKey).filter(Boolean)
    });
  }, [conversation, conversationId, historyStatus, isOfficial, messages]);

  useEffect(() => {
    if (!conversationId || !user?.id) {
      setHistoryStatus("idle");
      return undefined;
    }
    let active = true;
    setHistoryStatus("loading");
    setError("");
    setMessages([]);
    setHasMore(false);
    officialFirstOpenRef.current = false;
    if (import.meta.env.DEV) console.debug("[DM:history:start]");
    loadMessages(conversationId).then((data) => {
      if (!active) return;
      const history = extractHistory(data);
      const nextMessages = mergeMessages(history.messages, conversationId, user);
      setMessages(nextMessages);
      setHasMore(history.hasMore);
      setHistoryStatus("ready");
      if (import.meta.env.DEV) {
        console.debug("[DM:history:success]", { count: history.messages.length });
        console.debug("[OFFICIAL:page:messages]", {
          conversationId,
          apiCount: history.messages.length,
          pageCount: nextMessages.length,
          officialCount: nextMessages.filter((message) => message.messageType === "official").length,
          officialApi: history.official || null
        });
        if (otherUser?.isOfficial) {
          console.debug("[OFFICIAL:messages-api]", {
            conversationId,
            count: history.messages.length,
            officialKeys: nextMessages.map((message) => message.officialKey).filter(Boolean),
            officialApi: history.official || null
          });
        }
      }
      markRead(conversationId).catch(() => {});
      officialFirstOpenRef.current = Boolean(otherUser?.isOfficial && nextMessages.length);
    }).catch((requestError) => {
      if (!active) return;
      setError(requestError.message || "Nao foi possivel carregar esta conversa.");
      setHistoryStatus("error");
      if (import.meta.env.DEV) console.debug("[DM:history:error]", { error: requestError.message || "unknown" });
    }).finally(() => {
      if (import.meta.env.DEV) console.debug("[DM:history:finally]");
    });
    return () => { active = false; };
  }, [conversationId, loadMessages, markRead, retryVersion, user?.id, otherUser?.isOfficial]);

  useEffect(() => {
    if (!officialFirstOpenRef.current || !messages.length || !otherUser?.isOfficial || historyStatus !== "ready") return;
    officialFirstOpenRef.current = false;
    shouldAutoScrollRef.current = false;
    messagesRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [historyStatus, messages.length, otherUser?.isOfficial]);

  useEffect(() => {
    if (!conversationId || !otherUser || !socket) {
      setConversationReady(false);
      setRealtimeError("");
      setRealtimeStatus("offline");
      return undefined;
    }
    if (!socialReady) {
      setConversationReady(false);
      setRealtimeError(socialStatus === "error" ? "Sem conexao em tempo real." : "");
      setRealtimeStatus(socialStatus === "error" ? "error" : socket.connected ? "connecting" : "reconnecting");
      return undefined;
    }
    let active = true;
    let joined = false;
    setConversationReady(false);
    setRealtimeError("");
    setRealtimeStatus("connecting");
    if (import.meta.env.DEV) console.debug("[DM:realtime:init]", { conversationId });
    if (import.meta.env.DEV) console.debug("[DM:socket]", { connected: Boolean(socket.connected) });
    const handleMessage = (message) => {
      const incoming = normalizeMessage(message, conversationId, user);
      if (!incoming) return;
      setMessages((current) => appendUniqueMessage(current, incoming, conversationId));
      markRead(conversationId).catch(() => {});
    };
    const handleTyping = (payload) => {
      if (payload?.conversationId === conversationId && payload.userId !== user?.id) setTyping(Boolean(payload.typing));
    };
    socket.on("dm:new-message", handleMessage);
    socket.on("dm:typing", handleTyping);
    if (import.meta.env.DEV) console.debug("[DM:join:emit]", { conversationId, socketConnected: Boolean(socket.connected) });
    if (import.meta.env.DEV) console.debug("[DM:join:start]");
    socket.emit("dm:join", { conversationId }, (result) => {
      if (!active) return;
      if (import.meta.env.DEV) console.debug("[DM:join:ack]", { ok: Boolean(result?.ok), conversationId });
      if (!result?.ok) {
        setRealtimeStatus("error");
        setRealtimeError(result?.error || "Sem conexao em tempo real.");
        return;
      }
      joined = true;
      setRealtimeStatus("connected");
      setRealtimeError("");
      setConversationReady(true);
      if (import.meta.env.DEV) console.debug("[DM:realtime:connected]");
    });
    return () => {
      active = false;
      window.clearTimeout(typingTimerRef.current);
      if (joined) socket.emit("dm:leave", { conversationId });
      setConversationReady(false);
      socket.off("dm:new-message", handleMessage);
      socket.off("dm:typing", handleTyping);
    };
  }, [conversationId, markRead, otherUser?.id, socialReady, socket, user?.id]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [text]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    else if (messages.length) setShowNewMessages(true);
  }, [messages.length]);

  function handleMessagesScroll(event) {
    const node = event.currentTarget;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
    shouldAutoScrollRef.current = nearBottom;
    if (nearBottom) setShowNewMessages(false);
  }

  function handleTypingInput(value) {
    if (isOfficial) return;
    const nextText = value.slice(0, 4000);
    setText(nextText);
    try { if (draftKey) localStorage.setItem(draftKey, nextText); } catch {}
    if (!socket || !conversationId || !conversationReady) return;
    socket.emit("dm:typing", { conversationId, typing: true });
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => socket.emit("dm:typing", { conversationId, typing: false }), 1200);
  }

  function sendMessage(event) {
    event.preventDefault();
    if (isOfficial) return;
    const cleanText = text.trim();
    if ((!cleanText && !selectedFile) || sending || !socket || !conversationReady) return;
    setError("");
    setSending(true);
    const submit = (attachment) => socket.timeout(10000).emit("dm:message", { conversationId, content: cleanText, attachment }, (transportError, result) => {
      setSending(false);
      if (transportError) { setError("Não foi possível enviar a mensagem."); return; }
      if (!result?.ok) { setError(result?.error || "Nao foi possivel enviar a mensagem."); return; }
      const savedMessage = normalizeMessage(result.message, conversationId, user);
      if (savedMessage) setMessages((current) => appendUniqueMessage(current, savedMessage, conversationId));
      playUiSound("dmSent", uiSoundsEnabled());
      setText("");
      try { if (draftKey) localStorage.removeItem(draftKey); } catch {}
      setSelectedFile(null);
      socket.emit("dm:typing", { conversationId, typing: false });
    });
    if (!selectedFile) { submit(null); return; }
    uploadFile(selectedFile).then(submit).catch((requestError) => { setSending(false); setError(requestError.message); });
  }

  function insertEmoji(emoji) {
    setText((current) => {
      const nextText = `${current}${emoji}`.slice(0, 4000);
      try { if (draftKey) localStorage.setItem(draftKey, nextText); } catch {}
      return nextText;
    });
    setIsEmojiOpen(false);
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!UPLOAD_MIME_TYPES.includes(file.type)) { setError("Este tipo de arquivo não é compatível."); return; }
    const validation = validateUploadFile(file);
    if (!validation.ok) { setError(validation.error); return; }
    setError("");
    setSelectedFile(file);
  }

  async function uploadFile(file) {
    const body = new FormData();
    body.append("file", file);
    let response;
    try {
      response = await fetch(`${SERVER_URL}/api/social/dms/${conversationId}/upload`, { method: "POST", body, credentials: "include" });
    } catch {
      throw new Error("Não foi possível enviar a mensagem.");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível enviar a mensagem.");
    return data.attachment;
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
    const node = messagesRef.current;
    const previousHeight = node?.scrollHeight || 0;
    const data = await loadMessages(conversationId, first.createdAt);
    setMessages((current) => mergeMessages(current, data.messages || [], conversationId, user));
    setHasMore(Boolean(data.hasMore));
    window.requestAnimationFrame(() => {
      if (node) node.scrollTop += node.scrollHeight - previousHeight;
    });
  }

  const openSidebarProfile = (profileUser, anchorRect) => setProfilePopover((current) => current?.user?.id === profileUser.id ? null : ({
    user: {
      ...profileUser,
      status: profileUser.id === user?.id ? user.status : onlineUserIds.has(profileUser.id) ? publicPresence(profileUser.status) : "offline"
    },
    anchorRect
  }));
  const sidebarProps = { activeTab: "friends", onTabChange: onNavigateFriends, conversations, onlineUserIds, user, onHome: onNavigateHome, onOpenConversation: onNavigateDm, onOpenSettings: onOpenAccountSettings, onHideConversation: async (id) => { await hideConversation(id); onNavigateFriends(); }, activeConversationId: conversationId, socialStatus };
  if (conversationStatus === "loading") return <main className="page fluxer-social-shell"><SocialRail onHome={onNavigateHome} notificationCount={notificationCount} /><SocialSidebar {...sidebarProps} /><section className="fluxer-dm-main"><SocialEmptyState title="Abrindo conversa..." copy="Estamos recuperando suas mensagens." /></section></main>;
  if (conversationStatus === "error") return <main className="page fluxer-social-shell"><SocialRail onHome={onNavigateHome} notificationCount={notificationCount} /><SocialSidebar {...sidebarProps} /><section className="fluxer-dm-main"><SocialEmptyState title="Conversa indisponivel" copy="Escolha uma conversa existente para continuar." action="Voltar para Amigos" onAction={onNavigateFriends} /></section></main>;

  const historyLoading = historyStatus === "loading";
  const historyError = historyStatus === "error";
  return <main className="page fluxer-social-shell">
    <SocialRail onHome={onNavigateHome} notificationCount={notificationCount} />
    <SocialSidebar {...sidebarProps} onOpenProfile={openSidebarProfile} />
    <section className="fluxer-dm-main">
      <header className={`dm-header fluxer-dm-header ${isOfficial ? "is-official" : ""}`}>
        <button type="button" className="dm-header-profile" onClick={(event) => openSidebarProfile({ ...otherUser, status: isOnline ? publicPresence(otherUser.status) : "offline" }, event.currentTarget.getBoundingClientRect())}>
          <Avatar user={otherUser} size={38} />
          <span><strong>{otherUser.displayName || otherUser.username}{isOfficial && <em className="official-badge">OFICIAL</em>}</strong><small>{isOfficial ? "Mensagem oficial do EchoLive" : `@${otherUser.username} · ${isOnline && publicPresence(otherUser.status) === "dnd" ? "Não perturbe" : isOnline && publicPresence(otherUser.status) === "online" ? "Online" : "Offline"}`}</small></span>
        </button>
      </header>
      <div ref={messagesRef} className="dm-messages fluxer-message-scroller" onScroll={handleMessagesScroll}>
        {showNewMessages && <button type="button" className="dm-new-messages" onClick={() => { shouldAutoScrollRef.current = true; setShowNewMessages(false); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}>↓ Novas mensagens</button>}
        {hasMore && <button type="button" className="text-button dm-load-more" onClick={loadOlder}>Carregar mensagens anteriores</button>}
        {historyLoading && !messages.length ? <DmSkeleton /> : historyError ? <div className="dm-load-error"><strong>Nao foi possivel carregar esta conversa.</strong><span>{error || "Tente novamente."}</span><button type="button" className="secondary-button" onClick={() => { setError(""); setRetryVersion((value) => value + 1); }}>Tentar novamente</button></div> : messages.length ? messages.map((message, index) => <Message key={message.id} message={message} mine={message.senderUserId === normalizeIdentity(user?.id)} compact={index > 0 && messages[index - 1].senderUserId === message.senderUserId && timestampValue(message.createdAt) - timestampValue(messages[index - 1].createdAt) < 5 * 60 * 1000} showDate={index === 0 || !sameDate(message.createdAt, messages[index - 1].createdAt)} onOpenImage={(source, alt) => setLightboxImage({ source, alt })} />) : <div className="dm-intro"><Avatar user={otherUser} size={64} /><h2>{otherUser.displayName || otherUser.username}</h2><p>{isOfficial ? "A mensagem oficial do EchoLive" : `@${otherUser.username}`}</p><span>Este e o inicio da conversa.</span></div>}
        <div className={`dm-typing ${typing ? "is-visible" : ""}`} aria-live="polite"><i /><i /><i /> {otherUser.displayName || otherUser.username} esta digitando</div>
        <div ref={bottomRef} />
      </div>
      {error && !historyError && <p className="social-feedback is-error dm-error">{error}</p>}
      {!isOfficial && realtimeStatus !== "connected" && <p className={`dm-realtime-status ${realtimeStatus === "error" ? "is-error" : ""}`} role="status">{realtimeError || (realtimeStatus === "reconnecting" ? "Reconectando..." : "Conectando ao tempo real...")}</p>}
      {isOfficial ? <div className="dm-official-notice"><Icon name="lock" size={16} /><span>Esta é uma mensagem oficial do EchoLive. Este canal é somente leitura.</span></div> : <form className="dm-composer" onSubmit={sendMessage}>
        {selectedFile && <SelectedAttachment file={selectedFile} onRemove={() => setSelectedFile(null)} />}
        <div className="dm-composer-row">
          <button type="button" className="composer-icon-button" onClick={() => fileInputRef.current?.click()} title="Adicionar anexo" aria-label="Adicionar anexo"><Icon name="plus" size={17} /></button>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept={`${MEDIA_ACCEPT},${FILE_ACCEPT}`} onChange={handleFileChange} />
          <textarea ref={composerRef} id="dm-message" value={text} onChange={(event) => handleTypingInput(event.target.value)} onKeyDown={handleComposerKeyDown} maxLength={4000} rows={1} placeholder={`Mensagem para @${otherUser.username}`} disabled={!conversationReady || sending} />
          <button type="button" className="composer-icon-button" onClick={() => setIsEmojiOpen((value) => !value)} title="Inserir emoji" aria-label="Inserir emoji"><span aria-hidden="true">😊</span></button>
          {(text.trim() || selectedFile) && <button type="submit" className="primary-button" disabled={sending || !conversationReady} aria-label="Enviar mensagem"><Icon name="send" size={16} /></button>}
          {isEmojiOpen && <div className="composer-popover dm-emoji-popover"><EmojiPicker onSelect={insertEmoji} /></div>}
        </div>
      </form>}
    </section>
    {profilePopover?.user?.id === user?.id && <ProfilePopover accountUser={user} profile={user} nickname={user.displayName || user.username} avatarUrl={user.avatarUrl || ""} onStatusChange={(nextStatus) => updateProfile({ status: nextStatus })} onEditProfile={() => { setProfilePopover(null); onOpenAccountSettings?.("profile"); }} onOpenSettings={() => { setProfilePopover(null); onOpenAccountSettings?.("profile"); }} onLogout={async () => { await logout(); onNavigateHome?.(); }} onClose={() => setProfilePopover(null)} />}
    {profilePopover && profilePopover.user?.id !== user?.id && <SocialUserProfilePopover participant={profilePopover.user} anchorRect={profilePopover.anchorRect} onClose={() => setProfilePopover(null)} onMessage={(person) => { setProfilePopover(null); onNavigateDm?.(conversationId, conversation); }} onViewProfile={(person) => { setProfilePopover(null); setProfileOpen(person); }} />}
    {profileOpen && <SocialUserProfileModal userId={profileOpen.id} initialUser={profileOpen} onClose={() => setProfileOpen(null)} onMessage={(nextConversation) => { setProfileOpen(null); onNavigateDm(nextConversation.id, nextConversation); }} />}
    {lightboxImage && <div className="dm-lightbox" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setLightboxImage(null); }}><button type="button" className="icon-button dm-lightbox-close" onClick={() => setLightboxImage(null)} aria-label="Fechar imagem" title="Fechar"><Icon name="close" size={20} /></button><img src={lightboxImage.source} alt={lightboxImage.alt || "Imagem ampliada"} /></div>}
  </main>;
}

function extractHistory(data) {
  const messages = Array.isArray(data?.messages)
    ? data.messages
    : Array.isArray(data?.history)
      ? data.history
      : Array.isArray(data?.data?.messages)
        ? data.data.messages
        : [];
  return {
    messages,
    hasMore: Boolean(data?.hasMore ?? data?.data?.hasMore),
    official: data?.official || data?.data?.official || null
  };
}

function Message({ message, mine, compact, showDate, onOpenImage }) {
  const sender = message.sender || {};
  const senderName = sender.displayName || sender.username || "Usuario";
  return <>{showDate && <DateDivider value={message.createdAt} />}<article className={`dm-message ${mine ? "is-mine" : ""} ${compact ? "is-compact" : ""} ${message.messageType === "official" ? "is-official" : ""}`}><div className="dm-message-avatar">{!compact && <Avatar user={sender} size={40} />}</div><div>{!compact && <div className="dm-message-meta"><strong>{senderName}{message.messageType === "official" && <em className="official-badge">OFICIAL</em>}</strong><small>{formatMessageTime(message.createdAt)}</small></div>}{message.content && <p>{linkifyMessage(message.content)}</p>}{message.attachment && <Attachment attachment={message.attachment} onOpenImage={onOpenImage} />}</div></article></>;
}

function DmSkeleton() { return <div className="dm-skeleton" aria-label="Carregando mensagens">{[1, 2, 3, 4].map((item) => <div key={item}><i /><span /><b /></div>)}</div>; }

function DateDivider({ value }) { const date = normalizeTimestamp(value); if (!date) return null; const current = new Date(date); const today = new Date(); const dayStart = (input) => new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime(); const delta = Math.round((dayStart(today) - dayStart(current)) / 86400000); const label = delta === 0 ? "Hoje" : delta === 1 ? "Ontem" : current.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }); return <div className="dm-date-divider"><span>{label}</span></div>; }

function sameDate(left, right) { const a = normalizeTimestamp(left); const b = normalizeTimestamp(right); return a && b && new Date(a).toDateString() === new Date(b).toDateString(); }

function SelectedAttachment({ file, onRemove }) { const [url, setUrl] = useState(""); useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]); return <div className="dm-selected-file"><div className="dm-selected-file-preview">{file.type.startsWith("image/") && url ? <img src={url} alt="Pré-visualização do anexo" /> : file.type.startsWith("video/") && url ? <video src={url} muted preload="metadata" /> : <Icon name="file" size={18} />}<span><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></span></div><button type="button" className="icon-button" onClick={onRemove} aria-label="Remover anexo"><Icon name="close" size={14} /></button></div>; }

function Attachment({ attachment, onOpenImage }) {
  const source = `${SERVER_URL}${attachment.url}`;
  if (attachment.type === "image") return <button type="button" className="dm-attachment dm-attachment-image-button" onClick={() => onOpenImage?.(source, attachment.name || "Imagem anexada")}><img src={source} alt={attachment.name || "Imagem anexada"} /></button>;
  if (attachment.type === "video") return <video className="dm-attachment-video" controls preload="metadata" src={source} />;
  return <a className="dm-file-attachment" href={source} target="_blank" rel="noreferrer"><Icon name="file" size={16} /><span><strong>{attachment.name || "Arquivo"}</strong><small>{formatFileSize(attachment.size)}</small></span></a>;
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeMessage(message, fallbackConversationId, fallbackUser) {
  if (!message || message.id == null) return null;
  const messageConversationId = message.conversationId ?? message.conversation_id ?? fallbackConversationId;
  if (messageConversationId == null) return null;
  const senderUserId = normalizeIdentity(message.senderUserId ?? message.sender_user_id ?? message.sender_id ?? message.userId ?? message.user_id ?? message.sender?.id ?? message.sender?.userId ?? fallbackUser?.id);
  const sender = message.sender || (senderUserId && normalizeIdentity(fallbackUser?.id) === senderUserId ? fallbackUser : null);
  return {
    ...message,
    id: String(message.id),
    conversationId: String(messageConversationId),
    senderUserId: senderUserId || null,
    sender,
    messageType: message.messageType ?? message.message_type ?? "user",
    officialKey: message.officialKey ?? message.official_key ?? null,
    attachment: message.attachment || null,
    createdAt: normalizeTimestamp(message.createdAt ?? message.created_at ?? message.timestamp)
  };
}

function mergeMessages(...sources) {
  const fallbackUser = sources.pop();
  const conversationId = String(sources.pop() || "");
  const merged = new Map();
  sources.flat().forEach((message) => {
    const normalized = normalizeMessage(message, conversationId, fallbackUser);
    if (normalized && normalized.conversationId === conversationId) merged.set(normalized.id, normalized);
  });
  return Array.from(merged.values()).sort((left, right) => timestampValue(left.createdAt) - timestampValue(right.createdAt));
}

function appendUniqueMessage(current, incoming, conversationId) {
  const normalized = normalizeMessage(incoming, conversationId);
  if (!normalized || normalized.conversationId !== String(conversationId)) return current;
  return mergeMessages(current, [normalized], conversationId, null);
}

function normalizeIdentity(value) {
  return value == null || value === "" ? "" : String(value);
}

function normalizeTimestamp(value) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function timestampValue(value) {
  const normalized = normalizeTimestamp(value);
  return normalized ? Date.parse(normalized) : Number.MAX_SAFE_INTEGER;
}

function formatMessageTime(value) {
  const normalized = normalizeTimestamp(value);
  if (!normalized) return "";
  return new Date(normalized).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
