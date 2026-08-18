import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;

export default function AuthModal({ open, initialMode = "login", onClose }) {
  const { availability, login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError("");
      setFieldErrors({});
    }
  }, [initialMode, open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  async function submit(event) {
    event.preventDefault();
    setError("");
    const nextFieldErrors = {};
    const cleanUsername = username.trim();

    if (mode === "register" && (cleanUsername.length < 3 || cleanUsername.length > 24)) {
      nextFieldErrors.username = "Use entre 3 e 24 caracteres.";
    } else if (mode === "register" && !USERNAME_PATTERN.test(cleanUsername)) {
      nextFieldErrors.username = "Use apenas letras, numeros e _.";
    }
    if (mode === "register" && !displayName.trim()) {
      nextFieldErrors.displayName = "Informe um nome de exibicao.";
    }
    if (mode === "register" && (password.length < 8 || password.length > 128)) {
      nextFieldErrors.password = "Use uma senha entre 8 e 128 caracteres.";
    }
    if (mode === "register" && password !== confirmation) {
      nextFieldErrors.confirmation = "As senhas nao conferem.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "register") {
        await register({ username, displayName, password });
      } else {
        await login({ username, password });
      }
      onClose();
    } catch (submitError) {
      if (submitError.code === "USERNAME_TAKEN") {
        setFieldErrors({ username: "Esse nome de usuario ja esta em uso." });
      } else if (submitError.code === "INVALID_USERNAME") {
        setFieldErrors({ username: submitError.message });
      } else {
        setError(submitError.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return <div className="modal-backdrop auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar"><Icon name="close" size={18} /></button>
      <p className="eyebrow">Conta EchoLive</p>
      <h2 id="auth-modal-title">{mode === "register" ? "Criar conta" : "Entrar"}</h2>
      <p className="auth-modal-copy">{mode === "register" ? "Guarde seu perfil para usar o mesmo nome em novas salas." : "Entre para manter seu perfil entre sessoes."}</p>
      {availability === "unavailable" && <p className="auth-unavailable" role="status">Contas estao temporariamente indisponiveis. O modo visitante continua funcionando.</p>}
      <form onSubmit={submit}>
        <label className="field">
          <span>Nome de usuario</span>
          <input autoFocus autoComplete="username" maxLength={24} value={username} onChange={(event) => { setUsername(event.target.value); setFieldErrors((current) => ({ ...current, username: "" })); }} placeholder="seu_usuario" aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? "auth-username-error" : undefined} />
          {fieldErrors.username && <small id="auth-username-error" className="field-error">{fieldErrors.username}</small>}
        </label>
        {mode === "register" && <label className="field">
          <span>Nome de exibicao</span>
          <input autoComplete="name" maxLength={40} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setFieldErrors((current) => ({ ...current, displayName: "" })); }} placeholder="Seu nome" aria-invalid={Boolean(fieldErrors.displayName)} aria-describedby={fieldErrors.displayName ? "auth-display-name-error" : undefined} />
          {fieldErrors.displayName && <small id="auth-display-name-error" className="field-error">{fieldErrors.displayName}</small>}
        </label>}
        <label className="field">
          <span>Senha</span>
          <input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} maxLength={128} value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: "" })); }} placeholder="Minimo de 8 caracteres" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "auth-password-error" : undefined} />
          {fieldErrors.password && <small id="auth-password-error" className="field-error">{fieldErrors.password}</small>}
        </label>
        {mode === "register" && <label className="field">
          <span>Confirmar senha</span>
          <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setFieldErrors((current) => ({ ...current, confirmation: "" })); }} aria-invalid={Boolean(fieldErrors.confirmation)} aria-describedby={fieldErrors.confirmation ? "auth-confirmation-error" : undefined} />
          {fieldErrors.confirmation && <small id="auth-confirmation-error" className="field-error">{fieldErrors.confirmation}</small>}
        </label>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Aguarde..." : mode === "register" ? "Criar conta" : "Entrar"}</button>
      </form>
      <button type="button" className="text-button auth-switch" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); setFieldErrors({}); }}>
        {mode === "register" ? "Ja tenho uma conta" : "Ainda nao tenho conta"}
      </button>
    </section>
  </div>;
}
