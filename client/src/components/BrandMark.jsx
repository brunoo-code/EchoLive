export default function BrandMark({ size = 40, className = "" }) {
  return <svg className={`brand-symbol-svg ${className}`} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="EchoLive">
    <rect x="5" y="7" width="38" height="31" rx="14" fill="currentColor" />
    <path d="M13 37.5 17.5 34H31" fill="currentColor" />
    <ellipse cx="17.5" cy="21" rx="3.3" ry="4.7" fill="var(--echo-accent, #61dceb)" />
    <ellipse cx="30.5" cy="21" rx="3.3" ry="4.7" fill="var(--echo-accent, #61dceb)" />
    <path d="M21 27c2.1 2.5 3.9 2.5 6 0" fill="none" stroke="var(--echo-accent, #61dceb)" strokeWidth="2.2" strokeLinecap="round" />
  </svg>;
}
