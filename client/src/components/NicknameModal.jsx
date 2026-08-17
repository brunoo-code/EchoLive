import { useEffect, useState } from "react";

export default function NicknameModal({ currentNickname, onClose, onSave }) {
  const [draft, setDraft] = useState(currentNickname || "");

  useEffect(() => {
    setDraft(currentNickname || "");
  }, [currentNickname]);

  function submit(event) {
    event.preventDefault();
    onSave(draft);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="nickname-modal" onSubmit={submit} role="dialog" aria-modal="true">
        <div>
          <p className="section-label">Alterar nick</p>
          <h2>Como voce quer aparecer?</h2>
        </div>
        <label className="field">
          <span>Nickname atual</span>
          <input
            maxLength={24}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary-button">
            Salvar nick
          </button>
        </div>
      </form>
    </div>
  );
}
