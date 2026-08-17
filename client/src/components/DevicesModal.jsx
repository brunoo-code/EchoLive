import { useEffect, useState } from "react";

export default function DevicesModal({ devices, selectedAudioId, selectedOutputId, selectedVideoId, onClose, onSave }) {
  const [audioId, setAudioId] = useState(selectedAudioId || "");
  const [outputId, setOutputId] = useState(selectedOutputId || "");
  const [videoId, setVideoId] = useState(selectedVideoId || "");

  useEffect(() => {
    setAudioId(selectedAudioId || "");
    setOutputId(selectedOutputId || "");
    setVideoId(selectedVideoId || "");
  }, [selectedAudioId, selectedOutputId, selectedVideoId]);

  function submit(event) {
    event.preventDefault();
    onSave({ audioId, outputId, videoId });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="nickname-modal devices-modal" onSubmit={submit} role="dialog" aria-modal="true">
        <p className="section-label">Dispositivos</p>
        <h2>Configuracoes de dispositivos</h2>
        <label className="field">
          <span>Microfone</span>
          <select value={audioId} onChange={(event) => setAudioId(event.target.value)}>
            <option value="">Padrao do navegador</option>
            {devices.audio.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Microfone"}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Saida de audio</span>
          <select value={outputId} onChange={(event) => setOutputId(event.target.value)}>
            <option value="">Padrao do sistema</option>
            {(devices.output || []).map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Saida de audio"}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Camera</span>
          <select value={videoId} onChange={(event) => setVideoId(event.target.value)}>
            <option value="">Padrao do navegador</option>
            {devices.video.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Camera"}</option>)}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Cancelar</button>
          <button type="submit" className="primary-button">Salvar</button>
        </div>
      </form>
    </div>
  );
}
