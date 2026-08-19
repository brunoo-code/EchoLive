import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";

export default function SocialRail({ onHome, notificationCount = 0 }) {
  return <nav className="social-rail" aria-label="Navegacao principal">
    <button type="button" className="social-rail-brand" onClick={onHome} title="Voltar para a Home" aria-label="Voltar para a Home"><BrandMark size={28} /></button>
    <span className="social-rail-divider" />
    <button type="button" className="social-rail-item is-active" title="Amigos" aria-label={notificationCount > 0 ? `Amigos, ${notificationCount} notificacoes` : "Amigos"}><Icon name="account" size={18} />{notificationCount > 0 && <b className="social-rail-badge">{notificationCount > 99 ? "99+" : notificationCount}</b>}</button>
    <button type="button" className="social-rail-item" onClick={onHome} title="Voltar para a Home" aria-label="Voltar para a Home"><Icon name="home" size={18} /></button>
  </nav>;
}
