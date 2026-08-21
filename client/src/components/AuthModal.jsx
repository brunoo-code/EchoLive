import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import BrandMark from "./BrandMark.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;

export default function AuthModal({ open, initialMode = "login", onClose }) {
  const { availability, login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeField, setActiveField] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError("");
      setFieldErrors({});
      setActiveField("");
      setShowPassword(false);
      setShowConfirmation(false);
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
        await register({ username, password });
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

  const isRegister = mode === "register";

  return <div className="modal-backdrop auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`auth-modal ${isRegister ? "is-register" : "is-login"} ${activeField ? `is-${activeField}-focus` : ""}`} role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar"><Icon name="close" size={18} /></button>
      <div className="auth-modal-brand"><span className="auth-modal-mark"><BrandMark size={32} /></span><span>EchoLive</span></div>
      <p className="eyebrow">{isRegister ? "Sua identidade" : "Sua conta EchoLive"}</p>
      <h2 id="auth-modal-title">{isRegister ? "Crie seu espaco no EchoLive." : "Que bom te ver de novo."}</h2>
      <p className="auth-modal-copy">{isRegister ? "Seu perfil acompanha voce pelas salas." : "Entre para continuar de onde parou."}</p>
      {availability === "unavailable" && <p className="auth-unavailable" role="status">Contas estao temporariamente indisponiveis. O modo visitante continua funcionando.</p>}
      <form onSubmit={submit}>
        {isRegister && <div className="auth-section-heading"><strong>Sua identidade</strong><small>Como voce vai aparecer por aqui.</small></div>}
        <label className="field">
          <span>Nome de usuario</span>
          <input autoFocus autoComplete="username" maxLength={24} value={username} onFocus={() => setActiveField("username")} onBlur={() => setActiveField("")} onChange={(event) => { setUsername(event.target.value); setFieldErrors((current) => ({ ...current, username: "" })); }} placeholder="seu_usuario" aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? "auth-username-error" : undefined} />
          {fieldErrors.username && <small id="auth-username-error" className="field-error">{fieldErrors.username}</small>}
        </label>
        {isRegister && <div className="auth-section-heading auth-security-heading"><strong>Seguranca</strong><small>Uma senha so sua.</small></div>}
        <label className="field">
          <span>Senha</span>
          <span className="auth-password-wrap"><input type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} maxLength={128} value={password} onFocus={() => setActiveField("password")} onBlur={() => setActiveField("")} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: "" })); }} placeholder="Minimo de 8 caracteres" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "auth-password-error" : undefined} /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} title={showPassword ? "Ocultar senha" : "Mostrar senha"}><Icon name={showPassword ? "eyeOff" : "eye"} size={16} /></button></span>
          {fieldErrors.password && <small id="auth-password-error" className="field-error">{fieldErrors.password}</small>}
        </label>
        {isRegister && <label className="field">
          <span>Confirmar senha</span>
          <span className="auth-password-wrap"><input type={showConfirmation ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onFocus={() => setActiveField("confirmation")} onBlur={() => setActiveField("")} onChange={(event) => { setConfirmation(event.target.value); setFieldErrors((current) => ({ ...current, confirmation: "" })); }} aria-invalid={Boolean(fieldErrors.confirmation)} aria-describedby={fieldErrors.confirmation ? "auth-confirmation-error" : undefined} /><button type="button" className="auth-password-toggle" onClick={() => setShowConfirmation((current) => !current)} aria-label={showConfirmation ? "Ocultar confirmação" : "Mostrar confirmação"} title={showConfirmation ? "Ocultar confirmação" : "Mostrar confirmação"}><Icon name={showConfirmation ? "eyeOff" : "eye"} size={16} /></button></span>
          {fieldErrors.confirmation && <small id="auth-confirmation-error" className="field-error">{fieldErrors.confirmation}</small>}
        </label>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting && <i className="auth-loader" aria-hidden="true" />}{isSubmitting ? (isRegister ? "Criando..." : "Entrando...") : isRegister ? "Criar conta" : "Entrar"}</button>
      </form>
      <button type="button" className="text-button auth-switch" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); setFieldErrors({}); }}>
        {isRegister ? "Ja tenho uma conta" : "Ainda nao tenho conta"}
      </button>
    </section>
  </div>;
}
