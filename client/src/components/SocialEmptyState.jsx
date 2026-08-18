import BrandMark from "./BrandMark.jsx";

export default function SocialEmptyState({ title, copy, action, onAction, variant = 0 }) {
  return <div className="social-empty-state">
    <div className="social-empty-eko"><BrandMark size={82} variant={variant} /></div>
    <h3>{title}</h3>
    <p>{copy}</p>
    {action && <button type="button" className="primary-button" onClick={onAction}>{action}</button>}
  </div>;
}
