import Icon from "./Icon.jsx";

export default function EkoGuide({ mode = "idle", activeIntent = "quick", onIntentChange, onIntentEnd, onQuickEntry, onCreateAccount }) {
  const isQuick = mode === "quick" || mode === "quickCelebrate";

  return <section className="eko-guide" aria-label="Eko e atalhos do EchoLive">
    <div className={`eko-visual eko-visual-${mode}`} data-mode={mode} data-intent={activeIntent}>
      <span className="eko-orbit eko-orbit-one" aria-hidden="true" />
      <span className="eko-orbit eko-orbit-two" aria-hidden="true" />
      <svg className="eko-svg" viewBox="0 0 220 180" role="img" aria-label="Eko">
        <path className="eko-shadow" d="M48 158c23-14 101-18 128 0-21 13-105 15-128 0Z" />
        <path className="eko-antenna" d="M110 27c-3-13 6-20 15-24 3 10-2 20-15 24Z" />
        <path className="eko-ear" d="M42 74c-16-5-24 4-21 18 3 11 12 17 25 12Z" />
        <path className="eko-ear" d="M178 74c16-5 24 4 21 18-3 11-12 17-25 12Z" />
        <path className="eko-body" d="M72 132c5 23 17 36 38 36s33-13 38-36Z" />
        <path className="eko-arm eko-arm-left" d="M76 140c-14 6-18 17-10 23 8 5 16-2 20-12" />
        <g className="eko-arm eko-arm-wave">
          <path d="M144 140c14 6 18 17 10 23-8 5-16-2-20-12" />
          <path className="eko-hand" d="M152 157c5-1 7 2 5 5-2 3-6 2-8 0" />
        </g>
        <rect className="eko-head" x="45" y="38" width="130" height="94" rx="43" />
        <rect className="eko-face" x="58" y="52" width="104" height="66" rx="30" />
        <ellipse className="eko-eye" cx="88" cy="82" rx="9" ry="14" />
        <ellipse className="eko-eye" cx="132" cy="82" rx="9" ry="14" />
        <circle className="eko-cheek" cx="73" cy="101" r="4" />
        <circle className="eko-cheek" cx="147" cy="101" r="4" />
        <path className="eko-smile" d="M97 97c7 9 19 9 26 0" />
        <path className="eko-wave" d="M98 148v12M106 143v21M114 148v12M122 141v23" />
      </svg>
      {isQuick && <span className="eko-speaking-wave eko-context-wave" aria-hidden="true"><b /><b /><b /></span>}
    </div>
    <div className="eko-intent-list" aria-label="Escolha como quer começar">
      <button
        type="button"
        className={`eko-intent ${activeIntent === "quick" ? "is-active" : ""}`}
        onMouseEnter={() => onIntentChange?.("quick")}
        onMouseLeave={onIntentEnd}
        onFocus={() => onIntentChange?.("quick")}
        onBlur={onIntentEnd}
        onClick={() => { onIntentChange?.("quick"); onQuickEntry?.(); }}
      >
        <span className="eko-intent-icon"><Icon name="voice" size={15} /></span>
        <span><strong>Entrar rapido <em className="eko-intent-arrow" aria-hidden="true">&rarr;</em></strong><small>Uma sala rapida resolve.</small></span>
      </button>
      <button
        type="button"
        className={`eko-intent ${activeIntent === "account" ? "is-active" : ""}`}
        onMouseEnter={() => onIntentChange?.("account")}
        onMouseLeave={onIntentEnd}
        onFocus={() => onIntentChange?.("account")}
        onBlur={onIntentEnd}
        onClick={() => { onIntentChange?.("account"); onCreateAccount?.(); }}
      >
        <span className="eko-intent-icon"><Icon name="account" size={15} /></span>
        <span><strong>Criar uma conta <em className="eko-intent-arrow" aria-hidden="true">&rarr;</em></strong><small>Seu perfil continua com voce.</small></span>
      </button>
    </div>
  </section>;
}
