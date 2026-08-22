import BrandMark from "./BrandMark.jsx";

export default function SocialEmptyState({ title, copy, action, onAction, variant }) {
  return <div className="fluxer-social-empty-state">
    <div className="fluxer-social-empty-visual"><BrandMark size={82} variant={variant} /></div>
    <h3>{title}</h3>
    <p>{copy}</p>
    {action && <button type="button" className="primary-button" onClick={onAction}>{action}</button>}
  </div>;
}
