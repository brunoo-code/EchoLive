import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useServers } from "../servers/ServerContext.jsx";
import { SERVER_URL } from "../utils/webrtc.js";

export default function ServerInvitePage({ code, onNavigateHome, onNavigateServer }) {
  const { isAuthenticated } = useAuth();
  const { refreshServers } = useServers();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Abrindo convite...");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus("guest");
      setMessage("Entre na sua conta para aceitar este convite.");
      return undefined;
    }
    if (startedRef.current) return undefined;
    startedRef.current = true;
    let active = true;
    fetch(`${SERVER_URL}/api/server-invites/${encodeURIComponent(code)}/join`, { method: "POST", credentials: "include" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Convite inválido ou expirado.");
        return data;
      })
      .then(async (data) => {
        if (!active) return;
        await refreshServers().catch(() => {});
        if (data.server?.id) onNavigateServer?.(data.server.id);
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error.message);
      });
    return () => { active = false; };
  }, [code, isAuthenticated, onNavigateServer, refreshServers]);

  return <main className="page fluxer-server-page-gate server-invite-page"><section className="social-guest-gate" aria-live="polite"><Icon name={status === "error" ? "warning" : "link"} size={26} /><h1>{status === "error" ? "Convite indisponível" : status === "guest" ? "Convite para servidor" : "Convite de servidor"}</h1><p>{message}</p>{status === "guest" || status === "error" ? <button type="button" className="primary-button" onClick={onNavigateHome}>{status === "guest" ? "Ir para a Home" : "Voltar para a Home"}</button> : <span className="invite-loading">{code}</span>}</section></main>;
}
