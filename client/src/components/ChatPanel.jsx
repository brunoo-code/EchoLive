import { useEffect, useRef, useState } from "react";
import { SERVER_URL } from "../utils/webrtc.js";
import { playUiSound } from "../utils/uiSounds.js";
import Icon from "./Icon.jsx";
import EmojiPicker from "./EmojiPicker.jsx";
import { validateUploadFile } from "../utils/uploadLimits.js";
import { linkifyMessage } from "../utils/linkifyMessage.js";
import { ChatComposerFrame, ChatComposerRow, ChatHeader, ChatViewport } from "./ChatFrame.jsx";

const MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
const FILE_ACCEPT = "application/pdf,application/zip,text/plain,application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint,.docx,.xlsx,.pptx";
const ALL_ACCEPT = `${MEDIA_ACCEPT},${FILE_ACCEPT}`;

function formatTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatPanel({ socket, socketId, roomCode, messages, notify, uiSounds, notificationSoundsAllowed = true, displayName, isReady }) {
  const [draft, setDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [fileAccept, setFileAccept] = useState(ALL_ACCEPT);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const pendingLocalMessagesRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const knownMessageIdsRef = useRef(new Set());
  const hasSeenMessageBatchRef = useRef(false);

  useEffect(() => {
    function handleMessageCreated(message) {
      if (message.socketId !== socketId || pendingLocalMessagesRef.current < 1) return;
      pendingLocalMessagesRef.current -= 1;
      playUiSound("message-send", uiSounds);
    }
    function handleMessageError() {
      pendingLocalMessagesRef.current = Math.max(0, pendingLocalMessagesRef.current - 1);
    }
    socket?.on("message-created", handleMessageCreated);
    socket?.on("message-error", handleMessageError);
    return () => {
      socket?.off("message-created", handleMessageCreated);
      socket?.off("message-error", handleMessageError);
    };
  }, [socket, socketId, uiSounds]);

  useEffect(() => {
    function handleTypingUpdate({ socketId: remoteSocketId, displayName: remoteDisplayName, typing } = {}) {
      if (!remoteSocketId || remoteSocketId === socketId) return;

      setTypingUsers((current) => {
        if (!typing) {
          return current.filter((user) => user.socketId !== remoteSocketId);
        }

        const nextUser = { socketId: remoteSocketId, displayName: remoteDisplayName || "Alguem" };
        return current.some((user) => user.socketId === remoteSocketId)
          ? current.map((user) => user.socketId === remoteSocketId ? nextUser : user)
          : [...current, nextUser];
      });
    }

    socket?.on("typing:update", handleTypingUpdate);
    return () => socket?.off("typing:update", handleTypingUpdate);
  }, [socket, socketId]);

  useEffect(() => {
    const newRemoteMessages = hasSeenMessageBatchRef.current
      ? messages.filter((message) => !knownMessageIdsRef.current.has(message.id) && message.socketId !== socketId)
      : [];
    if (newRemoteMessages.length > 0 && notificationSoundsAllowed) playUiSound("message-received", uiSounds);
    messages.forEach((message) => knownMessageIdsRef.current.add(message.id));
    if (messages.length > 0) hasSeenMessageBatchRef.current = true;
  }, [messages, notificationSoundsAllowed, socketId, uiSounds]);

  function stopTyping() {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (isTypingRef.current) {
      socket?.emit("typing:stop");
      isTypingRef.current = false;
    }
  }

  function refreshTyping(nextDraft = draft) {
    if (!isReady || !socket?.connected || !nextDraft.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      socket.emit("typing:start");
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 2500);
  }

  useEffect(() => () => stopTyping(), [socket, isReady]);

  useEffect(() => {
    if (!lightboxImage) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") setLightboxImage(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage]);

  function validateFile(file) {
    if (!file) {
      return false;
    }

    const result = validateUploadFile(file);
    if (!result.ok) {
      notify(result.error);
      return false;
    }

    return true;
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(validateFile(file) ? file : null);
    event.target.value = "";
  }

  function openFilePicker(accept) {
    setFileAccept(accept);
    setIsAttachMenuOpen(false);
    setIsEmojiPickerOpen(false);
    setIsStickerPickerOpen(false);
    window.requestAnimationFrame(() => fileInputRef.current?.click());
  }

  function insertEmoji(emoji) {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const nextDraft = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`.slice(0, 4000);
    setDraft(nextDraft);
    setIsEmojiPickerOpen(false);
    setIsStickerPickerOpen(false);
    window.requestAnimationFrame(() => {
      input?.focus();
      const nextCursor = Math.min(start + emoji.length, 4000);
      input?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function uploadFile(file) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(
      `${SERVER_URL}/rooms/${encodeURIComponent(roomCode)}/upload?socketId=${encodeURIComponent(socketId)}`,
      { method: "POST", body }
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Falha ao enviar o arquivo.");
    }

    return result.attachment;
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();

    if (content.length > 4000) {
      notify("Esta mensagem excede o limite de 4.000 caracteres.");
      return;
    }

    if (!content && !selectedFile) {
      notify("Digite uma mensagem ou anexe um arquivo.");
      return;
    }

    setIsSending(true);

    try {
      const attachment = selectedFile ? await uploadFile(selectedFile) : null;
      stopTyping();
      socket?.emit("send-message", {
        channelId: "general",
        content,
        attachment
      });
      if (socket?.connected) pendingLocalMessagesRef.current += 1;
      setDraft("");
      setSelectedFile(null);
    } catch (error) {
      notify(error.message || "Nao foi possivel enviar a mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  function renderTypingLabel() {
    const names = typingUsers.map((user) => user.displayName).filter(Boolean);
    if (names.length === 1) return <><strong>{names[0]}</strong> esta digitando</>;
    if (names.length === 2) return <><strong>{names[0]}</strong> e <strong>{names[1]}</strong> estao digitando</>;
    return <><strong>{names[0]}</strong> e mais {names.length - 1} pessoas estao digitando</>;
  }

  return (
    <section className="chat-stage-inner" aria-label="Canal de texto geral">
      <ChatHeader title="geral" subtitle="Converse com os participantes da sala." />

      <ChatViewport>
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="empty-chat-icon" aria-hidden="true">#</div>
            <strong>Este e o comeco de # geral</strong>
            <span>Envie uma mensagem para conversar com a sala.</span>
          </div>
        )}
        {messages.map((message, index) => {
          const previousMessage = messages[index - 1];
          const isContinuation = Boolean(
            previousMessage &&
              previousMessage.socketId === message.socketId &&
              new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime() < 5 * 60 * 1000
          );
          const isNewMessage = hasSeenMessageBatchRef.current && !knownMessageIdsRef.current.has(message.id);

          return (
          <article className={`chat-message${isContinuation ? " is-grouped" : ""}${isNewMessage ? " is-new" : ""}`} key={message.id}>
            {isContinuation ? <div className="message-avatar-placeholder" aria-hidden="true"><time>{formatTime(message.createdAt)}</time></div> : <div className="message-avatar" aria-hidden="true">
              {message.nickname?.slice(0, 1).toUpperCase() || "?"}
            </div>}
            <div className="message-body">
              {!isContinuation && <div className="message-meta">
                <strong>{message.socketId === socketId ? (displayName || message.nickname) : message.nickname}</strong>
                <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
              </div>}
              {message.content && <p>{linkifyMessage(message.content)}</p>}
              {message.attachment && (
                <div className="message-attachment">
                  {message.attachment.type === "image" ? (
                    <button type="button" className="chat-image-button" onClick={() => setLightboxImage({ source: `${SERVER_URL}${message.attachment.url}`, alt: message.attachment.name || "Imagem anexada" })}>
                      <img src={`${SERVER_URL}${message.attachment.url}`} alt={message.attachment.name || "Imagem anexada"} />
                    </button>
                  ) : message.attachment.type === "video" ? (
                    <video controls preload="metadata" src={`${SERVER_URL}${message.attachment.url}`} />
                  ) : (
                    <a className="file-attachment" href={`${SERVER_URL}${message.attachment.url}`} target="_blank" rel="noreferrer" download>{message.attachment.name || "Arquivo"}</a>
                  )}
                  <span>{message.attachment.name} - {formatSize(message.attachment.size)}</span>
                </div>
              )}
            </div>
          </article>
          );
        })}
      </ChatViewport>

      <div className={`typing-indicator${typingUsers.length ? " is-active" : ""}`} aria-live="polite" aria-atomic="true">
        <span className="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>{typingUsers.length ? renderTypingLabel() : " "}</span>
      </div>

      <ChatComposerFrame onSubmit={sendMessage}>
        {selectedFile && (
          <div className="selected-file">
            <span>{selectedFile.name} ({formatSize(selectedFile.size)})</span>
            <button type="button" onClick={() => setSelectedFile(null)} aria-label="Remover anexo" title="Remover anexo"><Icon name="close" size={14} /></button>
          </div>
        )}
        <ChatComposerRow>
          <button type="button" className="attach-button" onClick={() => { setIsAttachMenuOpen((current) => !current); setIsEmojiPickerOpen(false); setIsStickerPickerOpen(false); }} disabled={isSending} title="Adicionar anexo" aria-label="Adicionar anexo" aria-haspopup="menu" aria-expanded={isAttachMenuOpen}>
            <Icon name="plus" size={17} />
          </button>
          {isAttachMenuOpen && <div className="composer-popover attach-menu" role="menu" aria-label="Adicionar anexo">
            <button type="button" role="menuitem" onClick={() => openFilePicker(MEDIA_ACCEPT)}><Icon name="image" size={15} /><span>Enviar imagem ou video</span></button>
            <button type="button" role="menuitem" onClick={() => openFilePicker(FILE_ACCEPT)}><Icon name="file" size={15} /><span>Enviar arquivo</span></button>
          </div>}
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept={fileAccept}
            onChange={handleFileChange}
          />
          <input
            ref={messageInputRef}
            className="message-input"
            maxLength={4000}
            placeholder="Mensagem em #geral"
            value={draft}
            onChange={(event) => {
              const nextDraft = event.target.value;
              setDraft(nextDraft);
              refreshTyping(nextDraft);
            }}
            disabled={isSending}
            aria-label="Mensagem para o canal geral"
          />
          {draft.length >= 3400 && <span className="message-counter">{draft.length} / 4000</span>}
          <div className="composer-actions">
            <button type="button" className="composer-icon-button" onClick={() => { setIsEmojiPickerOpen((current) => !current); setIsAttachMenuOpen(false); setIsStickerPickerOpen(false); }} disabled={isSending} title="Inserir emoji" aria-label="Inserir emoji" aria-expanded={isEmojiPickerOpen}><Icon name="smile" size={16} /></button>
            {false && <button type="button" className="composer-icon-button" onClick={() => { setIsStickerPickerOpen((current) => !current); setIsAttachMenuOpen(false); setIsEmojiPickerOpen(false); }} disabled={isSending} title="Abrir figurinhas do Eko" aria-label="Abrir figurinhas do Eko" aria-expanded={isStickerPickerOpen}><Icon name="sticker" size={16} /></button>}
            {(draft.trim() || selectedFile) && <button className="send-button" type="submit" disabled={isSending} aria-label={isSending ? "Enviando" : "Enviar mensagem"}>
              <Icon name="send" size={15} />
            </button>}
          </div>
          {isEmojiPickerOpen && <div className="composer-popover"><EmojiPicker onSelect={insertEmoji} /></div>}
          {isStickerPickerOpen && <div className="composer-popover sticker-picker" role="dialog" aria-label="Figurinhas do Eko">
            <strong>Figurinhas do Eko</strong>
            <span>As figurinhas oficiais serão adicionadas aqui.</span>
          </div>}
        </ChatComposerRow>
      </ChatComposerFrame>
      {lightboxImage && <div className="dm-lightbox chat-lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxImage(null); }}><button type="button" className="icon-button dm-lightbox-close" onClick={() => setLightboxImage(null)} aria-label="Fechar imagem" title="Fechar"><Icon name="close" size={20} /></button><img src={lightboxImage.source} alt={lightboxImage.alt} /></div>}
    </section>
  );
}
