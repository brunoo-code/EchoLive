/* SPDX-License-Identifier: AGPL-3.0-or-later. Rail presentation directly derived from Fluxer layout surfaces. */
import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";

export default function SocialRail({ onHome, notificationCount = 0 }) {
  return <nav className="fluxer-rail" aria-label="Navegacao principal" data-flx="app.layout.rail">
    <div className="fluxer-rail-scroll">
      <div className="fluxer-rail-top">
        <button type="button" className="fluxer-rail-button fluxer-rail-brand" onClick={onHome} title="Voltar para a Home" aria-label="Voltar para a Home"><BrandMark size={28} /></button>
        <span className="fluxer-rail-divider" />
        <button type="button" className="fluxer-rail-button is-active" title="Amigos" aria-label={notificationCount > 0 ? `Amigos, ${notificationCount} notificacoes` : "Amigos"}><Icon name="account" size={18} />{notificationCount > 0 && <b className="fluxer-rail-badge">{notificationCount > 99 ? "99+" : notificationCount}</b>}</button>
        <button type="button" className="fluxer-rail-button" onClick={onHome} title="Voltar para a Home" aria-label="Voltar para a Home"><Icon name="home" size={18} /></button>
      </div>
    </div>
  </nav>;
}
