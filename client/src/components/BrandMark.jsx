export default function BrandMark({ size = 40, className = "" }) {
  return <svg className={`brand-symbol-svg ${className}`} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="EchoLive"><path d="M10 8h22a6 6 0 0 1 6 6v9a6 6 0 0 1-6 6H22l-8 8v-8h-4a6 6 0 0 1-6-6v-9a6 6 0 0 1 6-6Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/><path d="M13 18h5l3-5 4 10 3-5h6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
