const iconPaths = {
  home: <><path d="m3 10 5-5 5 5" /><path d="M5 9v5h6V9" /></>,
  plus: <><path d="M8 3v10M3 8h10" /></>,
  more: <><circle cx="3" cy="8" r=".8" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r=".8" fill="currentColor" stroke="none" /><circle cx="13" cy="8" r=".8" fill="currentColor" stroke="none" /></>,
  copy: <><rect x="5" y="4" width="7" height="8" rx="1" /><path d="M3 10V3.5A1.5 1.5 0 0 1 4.5 2H10" /></>,
  code: <><path d="m5 4-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" /></>,
  leave: <><path d="M8 2v6M5.5 4.2a5 5 0 1 0 5 0" /><path d="m10.5 10.5 2 2 2-2M12.5 8.5v4" /></>,
  mic: <><rect x="5" y="2" width="6" height="8" rx="3" /><path d="M3 7a5 5 0 0 0 10 0M8 12v2M5 14h6" /></>,
  headphones: <><path d="M2.5 9a5.5 5.5 0 0 1 11 0" /><path d="M2.5 9v3h2V9h-2ZM13.5 9v3h-2V9h2Z" /></>,
  camera: <><rect x="2" y="4" width="8" height="8" rx="2" /><path d="m10 7 4-2v6l-4-2" /></>,
  monitor: <><rect x="2" y="3" width="12" height="8" rx="1" /><path d="M6 14h4M8 11v3" /></>,
  settings: <><path d="M8 2v2M8 12v2M2 8h2m8 0h2M3.8 3.8l1.4 1.4m5.6 5.6 1.4 1.4m0-8.4-1.4 1.4m-5.6 5.6-1.4 1.4" /><circle cx="8" cy="8" r="3" /></>,
  user: <><circle cx="8" cy="5" r="2.5" /><path d="M3 14a5 5 0 0 1 10 0" /></>,
  account: <><circle cx="8" cy="8" r="6" /><circle cx="8" cy="6" r="2" /><path d="M4.5 12.5a4 4 0 0 1 7 0" /></>,
  video: <><rect x="2" y="3" width="9" height="10" rx="2" /><path d="m11 7 3-2v6l-3-2" /></>,
  screen: <><rect x="2" y="3" width="12" height="8" rx="1" /><path d="M6 14h4M8 11v3" /></>,
  chat: <><path d="M3 3h10v8H7l-4 3V3Z" /><path d="M5.5 7h5M5.5 9h3" /></>,
  voice: <><path d="M3 7.5a5 5 0 0 1 10 0" /><path d="M3 7.5v3h2v-3H3ZM13 7.5v3h-2v-3h2ZM8 12v2M5.5 14h5" /></>,
  palette: <><path d="M8 2a6 6 0 1 0 0 12h1.5a1.5 1.5 0 0 0 0-3H8.2a1.2 1.2 0 0 1 0-2.4H10A4 4 0 0 0 8 2Z" /><circle cx="5" cy="6" r=".7" fill="currentColor" stroke="none" /><circle cx="7" cy="4.5" r=".7" fill="currentColor" stroke="none" /><circle cx="10" cy="5" r=".7" fill="currentColor" stroke="none" /></>,
  sliders: <><path d="M3 4h10M3 8h10M3 12h10" /><circle cx="6" cy="4" r="1.5" fill="var(--bg-panel)" /><circle cx="10" cy="8" r="1.5" fill="var(--bg-panel)" /><circle cx="5" cy="12" r="1.5" fill="var(--bg-panel)" /></>,
  close: <><path d="m4 4 8 8M12 4l-8 8" /></>,
  chevron: <path d="m4 6 4 4 4-4" />,
  edit: <><path d="m3 11-.5 3.5L6 14l7-7-3-3-7 7Z" /><path d="m8.5 4.5 3 3" /></>,
  trash: <><path d="M3 4h10M6 4V2h4v2M5 6v6m3-6v6m3-6v6M4 4l.6 10h6.8L12 4" /></>,
  check: <path d="m3 8 3 3 6-7" />,
  speaker: <><path d="M2.5 6h3l3-2.5v9l-3-2.5h-3z" /><path d="M11 6a3 3 0 0 1 0 4M12.5 4.5a5 5 0 0 1 0 7" /></>,
  link: <><path d="M6.5 9.5 5 11a2.8 2.8 0 0 1-4-4l2-2a2.8 2.8 0 0 1 4 0" /><path d="m9.5 6.5 1.5-1.5a2.8 2.8 0 0 1 4 4l-2 2a2.8 2.8 0 0 1-4 0" /><path d="m5.5 8.5 5-5" /></>,
  pulse: <path d="M2 8h3l1.5-4L9 12l1.5-4H14" />
};

export default function Icon({ name, size = 16, strokeWidth = 1.8, className = "", title }) {
  return <svg className={`ui-icon ${className}`} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined} aria-label={title} focusable="false">{iconPaths[name] || iconPaths.pulse}</svg>;
}
