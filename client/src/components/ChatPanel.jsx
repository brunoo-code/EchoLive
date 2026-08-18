import { useEffect, useRef, useState } from "react";
import { SERVER_URL } from "../utils/webrtc.js";
import { playUiSound } from "../utils/uiSounds.js";
import Icon from "./Icon.jsx";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf", "application/zip", "application/x-zip-compressed", "audio/mpeg", "audio/wav", "audio/ogg", "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

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

export default function ChatPanel({ socket, socketId, roomCode, messages, notify, uiSounds, displayName }) {
  const [draft, setDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);
  const pendingLocalMessagesRef = useRef(0);

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

  function validateFile(file) {
    if (!file) {
      return false;
    }

    if (!ACCEPTED_TYPES.has(file.type) || file.name.toLowerCase().endsWith(".svg")) {
      notify("Tipo de arquivo nao permitido.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      notify("Este arquivo excede o limite de 100 MB.");
      return false;
    }

    return true;
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(validateFile(file) ? file : null);
    event.target.value = "";
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

  return (
    <section className="chat-stage-inner" aria-label="Canal de texto geral">
      <header className="chat-header">
        <div>
          <p className="channel-title"><span aria-hidden="true">#</span> geral</p>
          <p className="channel-subtitle">Converse com os participantes da sala.</p>
        </div>
      </header>

      <div className="message-list" aria-live="polite">
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="empty-chat-icon" aria-hidden="true">#</div>
            <strong>Este e o comeco de # geral</strong>
            <span>Envie uma mensagem para conversar com a sala.</span>
          </div>
        )}
        {messages.map((message) => (
          <article className="chat-message" key={message.id}>
            <div className="message-avatar" aria-hidden="true">
              {message.nickname?.slice(0, 1).toUpperCase() || "?"}
            </div>
            <div className="message-body">
              <div className="message-meta">
                <strong>{message.socketId === socketId ? (displayName || message.nickname) : message.nickname}</strong>
                <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
              </div>
              {message.content && <p>{message.content}</p>}
              {message.attachment && (
                <div className="message-attachment">
                  {message.attachment.type === "image" ? (
                    <a href={`${SERVER_URL}${message.attachment.url}`} target="_blank" rel="noreferrer">
                      <img src={`${SERVER_URL}${message.attachment.url}`} alt={message.attachment.name || "Imagem anexada"} />
                    </a>
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
        ))}
      </div>

      <form className="chat-composer" onSubmit={sendMessage}>
        {selectedFile && (
          <div className="selected-file">
            <span>{selectedFile.name} ({formatSize(selectedFile.size)})</span>
            <button type="button" onClick={() => setSelectedFile(null)} aria-label="Remover anexo" title="Remover anexo"><Icon name="close" size={14} /></button>
          </div>
        )}
        <div className="composer-row">
          <button type="button" className="attach-button" onClick={() => fileInputRef.current?.click()} disabled={isSending}>
            Anexar
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,application/zip,audio/mpeg,audio/wav,audio/ogg,text/plain,.docx,.xlsx,.pptx"
            onChange={handleFileChange}
          />
          <input
            className="message-input"
            maxLength={4000}
            placeholder="Conversar em #geral"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={isSending}
            aria-label="Mensagem para o canal geral"
          />
          {draft.length >= 3400 && <span className="message-counter">{draft.length} / 4000</span>}
          <button className="send-button" type="submit" disabled={isSending}>
            {isSending ? "Enviando" : "Enviar"}
          </button>
        </div>
      </form>
    </section>
  );
}
