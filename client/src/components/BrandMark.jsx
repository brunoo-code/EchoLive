const markVariants = [
  ["#164e63", "#eefbff", "#67d8e4", "#071522"],
  ["#1f5c46", "#f2fff7", "#71d6a0", "#071b17"],
  ["#7c4a1d", "#fff7eb", "#f5c27b", "#241509"],
  ["#762f39", "#fff1f3", "#f5a4a9", "#241018"],
  ["#49318d", "#f5f1ff", "#a895ff", "#100c27"],
  ["#495361", "#f4f7fa", "#b8c4d1", "#16202a"]
];

export default function BrandMark({ size = 40, className = "", variant = null }) {
  const colors = Number.isInteger(variant) ? markVariants[((variant % markVariants.length) + markVariants.length) % markVariants.length] : null;
  const style = colors ? { "--brand-bg": colors[0], "--brand-shell": colors[1], "--brand-accent": colors[2], "--brand-visor": colors[3] } : undefined;

  return <svg className={`brand-symbol-svg ${className}`} style={style} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="EchoLive">
    {colors && <circle cx="24" cy="24" r="23" fill="var(--brand-bg)" />}
    <path d="M8 38.2c-1.6-2.7-2.5-5.8-2.5-9.4v-9.3C5.5 11.8 11.8 5.5 19.5 5.5h9c7.7 0 14 6.3 14 14v9.3c0 3.6-.9 6.7-2.5 9.4l-4.5-2.8H12.5L8 38.2Z" fill="var(--brand-shell, currentColor)" stroke="var(--brand-accent, var(--echo-accent, #61dceb))" strokeWidth={colors ? "1.2" : "0"} strokeLinejoin="round" />
    <rect x="7.5" y="13" width="33" height="22" rx="11" fill="var(--brand-visor, #071522)" />
    <ellipse cx="16.5" cy="23.5" rx="3" ry="4.3" fill="var(--brand-accent, var(--echo-accent, #61dceb))" />
    <ellipse cx="31.5" cy="23.5" rx="3" ry="4.3" fill="var(--brand-accent, var(--echo-accent, #61dceb))" />
    <path d="M20.5 29c2.4 2.5 4.6 2.5 7 0" fill="none" stroke="var(--brand-accent, var(--echo-accent, #61dceb))" strokeWidth="2.2" strokeLinecap="round" />
  </svg>;
}
