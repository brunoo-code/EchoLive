import { useEffect, useState } from "react";
import UserStatusBadge from "./UserStatusBadge.jsx";

const sections = ["profile", "account", "voice", "appearance", "preferences"];
const labels = { profile: "Perfil", account: "Conta", voice: "Voz e video", appearance: "Aparencia", preferences: "Preferencias" };
const descriptions = { profile: "Identidade e presenca", account: "Dados locais", voice: "Dispositivos", appearance: "Tema e cor", preferences: "Comportamento" };

export default function SettingsModal({ initialSection = "profile", theme, onThemeChange, accentColor, onAccentChange, uiSounds, onUiSoundsChange, confirmLeaveRoom, onConfirmLeaveChange, onOpenDevices, streamPreset, onStreamPresetChange, profile, onProfileChange, onClose }) {
  const [active, setActive] = useState(sections.includes(initialSection) ? initialSection : "profile");
  const [draft, setDraft] = useState(profile);

  useEffect(() => {
    setActive(sections.includes(initialSection) ? initialSection : "profile");
  }, [initialSection]);

  function update(key, value) { setDraft((current) => ({ ...current, [key]: value })); }

  function selectAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type) || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => update("avatarUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function saveProfile() {
    onProfileChange({
      ...draft,
      displayName: draft.displayName.trim().slice(0, 24),
      nickname: draft.nickname.trim().slice(0, 24),
      customStatus: draft.customStatus.trim().slice(0, 60),
      status: draft.status === "dnd" ? "dnd" : "online"
    });
  }

  const displayName = draft.displayName || "Nome de exibicao";
  const shortStatus = draft.status === "dnd" ? "Nao perturbe" : "Online";

  return <div className="modal-backdrop" role="presentation">
    <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header className="settings-header"><div><p className="section-label">Preferencias</p><h2 id="settings-title">Configuracoes</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar configuracoes">x</button></header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Secoes de configuracoes">{sections.map((section) => <button type="button" key={section} className={active === section ? "settings-nav-active" : ""} onClick={() => setActive(section)}><span className={`settings-nav-icon settings-nav-icon-${section}`} aria-hidden="true" /><span className="settings-nav-copy"><strong>{labels[section]}</strong><small>{descriptions[section]}</small></span></button>)}</nav>
        <div className="settings-content">
          {active === "profile" && <section className="settings-section">
            <h3>Perfil</h3>
            <div className="profile-edit-preview"><div className="profile-preview">{draft.avatarUrl ? <img src={draft.avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}<UserStatusBadge status={draft.status} size="lg" /></div><div><strong>{displayName}</strong><span>@{draft.nickname || "nickname"}</span><small><UserStatusBadge status={draft.status} size="sm" />{shortStatus}{draft.customStatus ? ` - ${draft.customStatus}` : ""}</small></div></div>
            <div className="profile-photo-actions"><label className="ghost-button profile-upload">Alterar foto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} /></label>{draft.avatarUrl && <button type="button" className="ghost-button" onClick={() => update("avatarUrl", "")}>Remover foto</button>}</div>
            <label className="field"><span>Nome de exibicao</span><input maxLength={24} value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} /></label>
            <label className="field"><span>Nickname</span><input maxLength={24} value={draft.nickname} onChange={(event) => update("nickname", event.target.value)} /></label>
            <label className="field"><span>Status</span><select value={draft.status === "dnd" ? "dnd" : "online"} onChange={(event) => update("status", event.target.value)}><option value="online">Online</option><option value="dnd">Nao perturbe</option></select></label>
            <label className="field"><span>Status personalizado</span><input maxLength={60} placeholder="Defina um status" value={draft.customStatus} onChange={(event) => update("customStatus", event.target.value)} /></label>
            <button type="button" className="primary-button" onClick={saveProfile}>Salvar alteracoes</button>
          </section>}
          {active === "account" && <section className="settings-section"><h3>Conta</h3><div className="settings-readonly"><span>Identidade local</span><strong>Este navegador</strong></div><p>Seu perfil e salvo localmente neste navegador.</p></section>}
          {active === "voice" && <section className="settings-section"><h3>Voz e video</h3><p>Escolha microfone, saida de audio, camera e qualidade da transmissao.</p><button type="button" className="ghost-button" onClick={onOpenDevices}>Abrir dispositivos</button><div className="stream-preset-grid" aria-label="Qualidade da transmissao">
            {[['720p30', '720p', '30 FPS'], ['720p60', '720p', '60 FPS'], ['1080p30', '1080p', '30 FPS'], ['1080p60', '1080p', '60 FPS']].map(([value, resolution, fps]) => <button type="button" key={value} className={`stream-preset ${streamPreset === value ? "is-selected" : ""}`} onClick={() => onStreamPresetChange(value)} aria-pressed={streamPreset === value}><strong>{resolution}</strong><span>{fps}</span></button>)}
          </div><small className="settings-help">O navegador pode adaptar a qualidade conforme o dispositivo e a rede.</small></section>}
          {active === "appearance" && <section className="settings-section"><h3>Aparencia</h3><label className="field"><span>Tema</span><select value={theme} onChange={(event) => onThemeChange(event.target.value)}><option value="dark">Escuro</option><option value="light">Claro</option><option value="system">Sistema</option></select></label><div className="accent-preview"><span style={{ background: accentColor }} /><strong>Cor de destaque</strong></div><div className="accent-swatches">{["#22d3ee", "#3b82f6", "#8b5cf6", "#22c55e", "#ec4899", "#f97316"].map((color) => <button type="button" key={color} className={accentColor === color ? "is-selected" : ""} style={{ background: color }} onClick={() => onAccentChange(color)} aria-label={`Usar cor ${color}`} title={`Usar cor ${color}`} />)}<label className="accent-custom"><input type="color" value={accentColor} onChange={(event) => onAccentChange(event.target.value)} aria-label="Escolher cor personalizada" /></label></div><button type="button" className="ghost-button" onClick={() => onAccentChange("#22d3ee")}>Restaurar aparencia padrao</button></section>}
          {active === "preferences" && <section className="settings-section"><h3>Preferencias</h3><label className="settings-toggle"><input type="checkbox" checked={uiSounds} onChange={(event) => onUiSoundsChange(event.target.checked)} /><span>Sons da interface</span></label><label className="settings-toggle"><input type="checkbox" checked={confirmLeaveRoom} onChange={(event) => onConfirmLeaveChange(event.target.checked)} /><span>Confirmar ao sair da sala</span></label></section>}
        </div>
      </div>
    </section>
  </div>;
}
