export default function SettingsModal({
  theme,
  onThemeChange,
  uiSounds,
  onUiSoundsChange,
  confirmLeaveRoom,
  onConfirmLeaveChange,
  onOpenDevices,
  onClose
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <p className="section-label">Preferencias</p>
            <h2 id="settings-title">Configuracoes</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar configuracoes" aria-label="Fechar configuracoes">x</button>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Secoes de configuracoes">
            <span className="settings-nav-active">Conta</span>
            <span>Voz e video</span>
            <span>Aparencia</span>
            <span>Preferencias</span>
          </nav>
          <div className="settings-content">
            <section className="settings-section">
              <h3>Conta</h3>
              <div className="settings-readonly"><span>Nickname</span><strong>Seu perfil</strong></div>
              <p>Altere seu nickname pelo painel da sala.</p>
            </section>
            <section className="settings-section">
              <h3>Voz e video</h3>
              <p>Microfone, saida de audio e camera ficam na configuracao de dispositivos.</p>
              <button type="button" className="ghost-button" onClick={onOpenDevices}>Abrir dispositivos</button>
            </section>
            <section className="settings-section">
              <h3>Aparencia</h3>
              <label className="field">
                <span>Tema</span>
                <select value={theme} onChange={(event) => onThemeChange(event.target.value)}>
                  <option value="dark">Escuro</option>
                  <option value="light">Claro</option>
                  <option value="system">Sistema</option>
                </select>
              </label>
            </section>
            <section className="settings-section">
              <h3>Transmissao</h3>
              <div className="settings-readonly"><span>Qualidade</span><strong>720p</strong></div>
              <div className="settings-readonly"><span>FPS</span><strong>30</strong></div>
            </section>
            <section className="settings-section">
              <h3>Preferencias</h3>
              <label className="settings-toggle"><input type="checkbox" checked={uiSounds} onChange={(event) => onUiSoundsChange(event.target.checked)} /><span>Sons da interface</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={confirmLeaveRoom} onChange={(event) => onConfirmLeaveChange(event.target.checked)} /><span>Confirmar ao sair da sala</span></label>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
