import { extractInlineGifUrls } from "../utils/inlineGifEmbeds.js";

export default function InlineGifEmbeds({ content, onOpenImage }) {
  const gifUrls = extractInlineGifUrls(content);
  if (!gifUrls.length) return null;

  return <div className="fluxer-inline-gif-embeds" aria-label="GIFs na mensagem">
    {gifUrls.map((url) => onOpenImage ? <button type="button" className="fluxer-inline-gif-button" key={url} onClick={() => onOpenImage(url, "GIF")} aria-label="Abrir GIF">
      <img src={url} alt="GIF" loading="lazy" />
    </button> : <a className="fluxer-inline-gif-link" key={url} href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="GIF" loading="lazy" />
    </a>)}
  </div>;
}
