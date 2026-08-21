import { useEffect, useMemo, useRef, useState } from "react";
import UserStatusBadge from "./UserStatusBadge.jsx";
import UserBadges from "./UserBadges.jsx";
import Icon from "./Icon.jsx";

const sections = ["profile", "account", "voice", "appearance", "preferences"];
const labels = { profile: "Perfil", account: "Conta", voice: "Voz e video", appearance: "Aparencia", preferences: "Preferencias" };
const descriptions = { profile: "Identidade e presenca", account: "Dados da conta", voice: "Dispositivos", appearance: "Tema e cor", preferences: "Comportamento" };

function normalizedProfile(profile = {}) {
  return {
    displayName: profile.displayName || "",
    username: profile.username || "",
    avatarUrl: profile.avatarUrl || "",
    pronouns: profile.pronouns || "",
    aboutMe: profile.aboutMe || "",
    accentColor: profile.accentColor || "#22D3EE",
    customStatus: profile.customStatus || "",
    status: ["online", "dnd", "invisible"].includes(profile.status) ? profile.status : "online",
    badges: profile.badges || []
  };
}

function profileSignature(profile) {
  const normalized = normalizedProfile(profile);
  return JSON.stringify({
    displayName: normalized.displayName,
    avatarUrl: normalized.avatarUrl,
    pronouns: normalized.pronouns,
    aboutMe: normalized.aboutMe,
    accentColor: normalized.accentColor.toUpperCase(),
    customStatus: normalized.customStatus,
    status: normalized.status
  });
}

export default function SettingsModal({ initialSection = "profile", availableSections = sections, theme, onThemeChange, accentColor, onAccentChange, uiSounds, onUiSoundsChange, confirmLeaveRoom, onConfirmLeaveChange, onOpenDevices, streamPreset, onStreamPresetChange, profile, onProfileChange, isPersistentProfile = false, onClose }) {
  const visibleSections = useMemo(() => sections.filter((section) => availableSections.includes(section)), [availableSections]);
  const resolvedInitialSection = visibleSections.includes(initialSection) ? initialSection : visibleSections[0] || "profile";
  const [active, setActive] = useState(resolvedInitialSection);
  const [savedProfile, setSavedProfile] = useState(() => normalizedProfile(profile));
  const [draft, setDraft] = useState(() => normalizedProfile(profile));
  const [saveState, setSaveState] = useState("idle");
  const [profileError, setProfileError] = useState("");
  const modalRef = useRef(null);

  useEffect(() => {
    setActive(resolvedInitialSection);
  }, [resolvedInitialSection]);

  useEffect(() => {
    const next = normalizedProfile(profile);
    setSavedProfile(next);
    setDraft(next);
  }, [profile]);

  const isDirty = useMemo(() => profileSignature(draft) !== profileSignature(savedProfile), [draft, savedProfile]);
  const displayName = draft.displayName.trim() || "Nome de exibicao";
  const statusLabel = draft.status === "dnd" ? "Nao perturbe" : draft.status === "invisible" ? "Invisivel" : "Online";

  function requestClose() {
    if (isDirty && !window.confirm("Descartar alteracoes nao salvas?")) return;
    onClose?.();
  }

  useEffect(() => {
    const modal = modalRef.current;
    const focusableSelector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";
    modal?.querySelector(focusableSelector)?.focus();
  }, []);

  useEffect(() => {
    const modal = modalRef.current;
    const focusableSelector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isDirty || window.confirm("Descartar alteracoes nao salvas?")) onClose?.();
        return;
      }
      if (event.key !== "Tab" || !modal) return;
      const focusable = [...modal.querySelectorAll(focusableSelector)].filter((element) => !element.hidden && element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, onClose]);

  function update(key, value) {
    setProfileError("");
    setSaveState("idle");
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function selectAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type)) {
      setProfileError("Use uma imagem PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError("A imagem do perfil deve ter no maximo 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("avatarUrl", String(reader.result || ""));
    reader.onerror = () => setProfileError("Nao foi possivel ler esta imagem.");
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    const next = {
      ...draft,
      displayName: draft.displayName.trim(),
      pronouns: draft.pronouns.trim(),
      aboutMe: draft.aboutMe.trim(),
      customStatus: draft.customStatus.trim(),
      accentColor: draft.accentColor.toUpperCase()
    };
    if (!next.displayName || next.displayName.length > 40) {
      setProfileError("Use um nome de exibicao entre 1 e 40 caracteres.");
      return;
    }
    setSaveState("saving");
    setProfileError("");
    try {
      const saved = await onProfileChange(next);
      const canonical = normalizedProfile(saved || next);
      setSavedProfile(canonical);
      setDraft(canonical);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setProfileError(error.message || "Nao foi possivel salvar o perfil.");
    }
  }

  function discardProfileChanges() {
    setDraft(savedProfile);
    setProfileError("");
    setSaveState("idle");
  }

  return <div className="modal-backdrop settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) requestClose(); }}>
    <section ref={modalRef} className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header className="settings-header"><div><p className="section-label">EchoLive</p><h2 id="settings-title">Configuracoes</h2></div><button type="button" className="icon-button" onClick={requestClose} aria-label="Fechar configuracoes" title="Fechar"><Icon name="close" size={18} /></button></header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Secoes de configuracoes">{visibleSections.map((section) => <button type="button" key={section} className={active === section ? "settings-nav-active" : ""} onClick={() => setActive(section)}><span className="settings-nav-icon" aria-hidden="true"><Icon name={section === "profile" ? "user" : section === "account" ? "account" : section === "voice" ? "voice" : section === "appearance" ? "palette" : "sliders"} size={17} /></span><span className="settings-nav-copy"><strong>{labels[section]}</strong><small>{descriptions[section]}</small></span></button>)}</nav>
        <main className="settings-content">
          {active === "profile" && <section className="settings-section settings-profile-section">
            <div className="settings-section-heading"><span className="section-label">IDENTIDADE</span><h3>Perfil</h3><p>{isPersistentProfile ? "Estas informacoes acompanham sua conta em todo o EchoLive." : "Perfis temporarios usam a identidade automatica da Sala Rapida."}</p></div>
            {isPersistentProfile ? <div className="settings-profile-form">
              <div className="profile-photo-actions"><div className="profile-edit-avatar">{draft.avatarUrl ? <img src={draft.avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}<UserStatusBadge status={draft.status} size="lg" /></div><div><label className="secondary-button profile-upload"><Icon name="image" size={15} />Alterar avatar<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} /></label>{draft.avatarUrl && <button type="button" className="text-button" onClick={() => update("avatarUrl", "")}>Remover</button>}<small>PNG, JPEG ou WebP. Maximo 2 MB.</small></div></div>
              <div className="settings-profile-grid"><label className="field"><span>Nome de exibicao</span><input maxLength={40} value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} /></label><label className="field"><span>Pronomes</span><input maxLength={40} placeholder="Opcional" value={draft.pronouns} onChange={(event) => update("pronouns", event.target.value)} /></label></div>
              <div className="settings-readonly"><span>Nome de usuario</span><strong>@{draft.username || "username"}</strong></div>
              <label className="field"><span>Status</span><select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="online">Online</option><option value="dnd">Nao perturbe</option><option value="invisible">Invisivel</option></select></label>
              <label className="field"><span>Status personalizado</span><input maxLength={80} placeholder="O que esta acontecendo?" value={draft.customStatus} onChange={(event) => update("customStatus", event.target.value)} /><small>{draft.customStatus.length}/80</small></label>
              <label className="field"><span>Sobre mim</span><textarea maxLength={300} rows={5} placeholder="Conte um pouco sobre voce" value={draft.aboutMe} onChange={(event) => update("aboutMe", event.target.value)} /><small>{draft.aboutMe.length}/300</small></label>
              <label className="field settings-profile-accent"><span>Cor do perfil</span><div><input type="color" value={draft.accentColor} onChange={(event) => update("accentColor", event.target.value)} /><code>{draft.accentColor.toUpperCase()}</code></div></label>
              {profileError && <p className="field-error" role="alert">{profileError}</p>}
            </div> : <div className="settings-guest-profile"><Icon name="account" size={22} /><div><strong>Identidade temporaria</strong><p>Crie uma conta para escolher nome, avatar e detalhes do perfil.</p></div></div>}
          </section>}
          {active === "account" && <section className="settings-section"><div className="settings-section-heading"><span className="section-label">CONTA</span><h3>Sua conta</h3><p>Identidade publica e sessao atual.</p></div><div className="settings-readonly"><span>Nome de usuario</span><strong>{draft.username ? `@${draft.username}` : "Visitante"}</strong></div><div className="settings-readonly"><span>Persistencia</span><strong>{isPersistentProfile ? "Sincronizada com sua conta" : "Somente nesta sessao"}</strong></div></section>}
          {active === "voice" && <section className="settings-section"><div className="settings-section-heading"><span className="section-label">MIDIA</span><h3>Voz e video</h3><p>Escolha dispositivos e qualidade da transmissao.</p></div><button type="button" className="secondary-button" onClick={onOpenDevices}><Icon name="sliders" size={16} />Abrir dispositivos</button><div className="settings-subsection"><span className="settings-subsection-title">Qualidade da transmissao</span><div className="stream-preset-grid" aria-label="Qualidade da transmissao">
            {[["720p30", "720p", "30 FPS"], ["720p60", "720p", "60 FPS"], ["1080p30", "1080p", "30 FPS"], ["1080p60", "1080p", "60 FPS"]].map(([value, resolution, fps]) => <button type="button" key={value} className={`stream-preset ${streamPreset === value ? "is-selected" : ""}`} onClick={() => onStreamPresetChange(value)} aria-pressed={streamPreset === value}><strong>{resolution}</strong><span>{fps}</span>{value === "1080p60" && <small>Maior uso de conexao</small>}</button>)}
          </div></div><small className="settings-help">O navegador pode adaptar a qualidade conforme o dispositivo e a rede.</small></section>}
          {active === "appearance" && <section className="settings-section"><div className="settings-section-heading"><span className="section-label">INTERFACE</span><h3>Aparencia</h3><p>Ajuste o tema e a cor de destaque do aplicativo.</p></div><label className="field"><span>Tema</span><select value={theme} onChange={(event) => onThemeChange(event.target.value)}><option value="dark">Escuro</option><option value="light">Claro</option><option value="system">Sistema</option></select></label><div className="accent-preview"><span style={{ background: accentColor }} /><strong>Cor de destaque</strong></div><div className="accent-swatches">{["#22d3ee", "#3b82f6", "#8b5cf6", "#22c55e", "#ec4899", "#f97316"].map((color) => <button type="button" key={color} className={accentColor === color ? "is-selected" : ""} style={{ background: color }} onClick={() => onAccentChange(color)} aria-label={`Usar cor ${color}`} title={`Usar cor ${color}`} />)}<label className="accent-custom"><input type="color" value={accentColor} onChange={(event) => onAccentChange(event.target.value)} aria-label="Escolher cor personalizada" /></label></div><button type="button" className="secondary-button" onClick={() => onAccentChange("#22d3ee")}>Restaurar aparencia padrao</button></section>}
          {active === "preferences" && <section className="settings-section"><div className="settings-section-heading"><span className="section-label">APLICATIVO</span><h3>Preferencias</h3><p>Controle feedbacks e confirmacoes.</p></div><label className="settings-toggle"><input type="checkbox" checked={uiSounds} onChange={(event) => onUiSoundsChange(event.target.checked)} /><span>Sons da interface e notificacoes</span></label><label className="settings-toggle"><input type="checkbox" checked={confirmLeaveRoom} onChange={(event) => onConfirmLeaveChange(event.target.checked)} /><span>Confirmar ao sair da sala</span></label></section>}
        </main>
        <aside className="settings-profile-preview" style={{ "--profile-accent": draft.accentColor }} aria-label="Preview do perfil">
          <span className="section-label">PREVIEW</span>
          <div className="settings-preview-card"><div className="settings-preview-cover" /><div className="settings-preview-body"><div className="settings-preview-avatar">{draft.avatarUrl ? <img src={draft.avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}<UserStatusBadge status={draft.status} size="lg" /></div><h3>{displayName}</h3><div className="settings-preview-user"><span>@{draft.username || "username"}</span><UserBadges badges={draft.badges} /></div>{draft.pronouns && <small>{draft.pronouns}</small>}<div className="settings-preview-status"><UserStatusBadge status={draft.status} size="sm" /><span>{draft.customStatus || statusLabel}</span></div>{draft.aboutMe && <div className="settings-preview-about"><strong>Sobre mim</strong><p>{draft.aboutMe}</p></div>}</div></div>
        </aside>
      </div>
      {active === "profile" && isPersistentProfile && (isDirty || saveState === "saved") && <footer className={`settings-unsaved-bar ${saveState === "saved" && !isDirty ? "is-saved" : ""}`}><span>{saveState === "saved" && !isDirty ? "Alteracoes salvas." : "Voce tem alteracoes nao salvas."}</span><div>{isDirty && <button type="button" className="text-button" onClick={discardProfileChanges} disabled={saveState === "saving"}>Redefinir</button>}<button type="button" className="primary-button" onClick={saveProfile} disabled={!isDirty || saveState === "saving"}>{saveState === "saving" ? "Salvando..." : "Salvar alteracoes"}</button></div></footer>}
    </section>
  </div>;
}
