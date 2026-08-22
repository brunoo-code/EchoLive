// SPDX-License-Identifier: AGPL-3.0-or-later
// Presentation structure derived from Fluxer's GifPickerView/GifPickerHeader/GifPickerGrid.
// EchoLive keeps its own provider adapter and message transport.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const RECENT_KEY = "echolive.recentGifs";

function normalizeGif(item, index) {
  if (!item || typeof item !== "object") return null;
  const url = item.url || item.mediaUrl || item.gif?.url || item.images?.original?.url || item.images?.fixed_height?.url;
  if (!url || typeof url !== "string") return null;
  const previewUrl = item.previewUrl || item.thumbnail || item.gif?.previewUrl || item.images?.fixed_width_small?.url || url;
  return {
    id: String(item.id || item.slug || `gif-${index}`),
    url,
    previewUrl,
    title: String(item.title || item.name || "GIF"),
    sourceUrl: item.sourceUrl || item.pageUrl || url,
    width: Number(item.width || item.images?.original?.width || 240),
    height: Number(item.height || item.images?.original?.height || 160)
  };
}

function normalizeResponse(data) {
  const items = Array.isArray(data) ? data : data?.results || data?.data || data?.gifs || [];
  return items.map(normalizeGif).filter(Boolean);
}

function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeGif).filter(Boolean).slice(0, 12) : [];
  } catch {
    return [];
  }
}

export default function GifPicker({ onSelect, onClose }) {
  const providerUrl = import.meta.env.VITE_GIF_PROVIDER_URL || "";
  const [query, setQuery] = useState("");
  const [view, setView] = useState("trending");
  const [items, setItems] = useState([]);
  const [recent, setRecent] = useState(readRecent);
  const [status, setStatus] = useState(providerUrl ? "loading" : "blocked");
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const inputRef = useRef(null);

  const endpoint = useMemo(() => {
    if (!providerUrl) return "";
    const url = new URL(providerUrl, window.location.origin);
    if (query.trim()) url.searchParams.set("q", query.trim());
    url.searchParams.set("limit", "24");
    return url.toString();
  }, [providerUrl, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const requestGifs = useCallback((targetEndpoint, signal) => {
    setStatus("loading");
    setError("");
    return fetch(targetEndpoint, { signal, credentials: "include" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar os GIFs.");
        return normalizeResponse(data);
      })
      .then((nextItems) => {
        setItems(nextItems);
        setStatus(nextItems.length ? "ready" : "empty");
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        setStatus("error");
        setError(requestError.message || "Não foi possível carregar os GIFs.");
      });
  }, []);

  useEffect(() => {
    if (!endpoint) return undefined;
    const controller = new AbortController();
    requestGifs(endpoint, controller.signal);
    return () => controller.abort();
  }, [endpoint, requestGifs, requestVersion]);

  const visibleItems = view === "recent" ? recent : items;
  function selectGif(gif) {
    const nextRecent = [gif, ...recent.filter((item) => item.id !== gif.id)].slice(0, 12);
    setRecent(nextRecent);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent)); } catch {}
    onSelect?.(gif);
    onClose?.();
  }

  return <section className="fluxer-gif-picker" aria-label="GIFs">
    <header className="fluxer-gif-picker-header">
      {view === "recent" && <button type="button" className="fluxer-icon-button" onClick={() => setView("trending")} aria-label="Voltar para GIFs" title="Voltar"><Icon name="arrow-left" size={17} /></button>}
      <div className="fluxer-gif-search">
        <Icon name="search" size={16} />
        <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setView("trending"); }} onKeyDown={(event) => { if (event.key === "Escape") onClose?.(); }} placeholder="Buscar GIFs" aria-label="Buscar GIFs" />
      </div>
      <button type="button" className="fluxer-icon-button" onClick={onClose} aria-label="Fechar GIFs" title="Fechar"><Icon name="close" size={17} /></button>
    </header>
    <nav className="fluxer-gif-picker-tabs" aria-label="Categorias de GIF">
      <button type="button" className={view === "trending" ? "is-active" : ""} onClick={() => setView("trending")}>Em alta</button>
      <button type="button" className={view === "recent" ? "is-active" : ""} onClick={() => setView("recent")} disabled={!recent.length}>Recentes</button>
      <span>{import.meta.env.VITE_GIF_PROVIDER_NAME || "GIF provider"}</span>
    </nav>
    <div className="fluxer-gif-picker-body">
      {view === "trending" && status === "blocked" && <div className="fluxer-picker-state"><Icon name="info" size={24} /><strong>GIFs ainda não configurados</strong><span>Defina VITE_GIF_PROVIDER_URL para conectar um provider compatível.</span></div>}
      {view === "trending" && status === "loading" && <div className="fluxer-gif-grid" aria-busy="true">{Array.from({ length: 8 }, (_, index) => <span className="fluxer-gif-skeleton" key={index} />)}</div>}
      {view === "trending" && status === "error" && <div className="fluxer-picker-state is-error"><Icon name="warning" size={24} /><strong>GIFs não puderam carregar</strong><span>{error}</span><button type="button" className="secondary-button" onClick={() => setRequestVersion((version) => version + 1)}>Tentar novamente</button></div>}
      {view === "trending" && status === "empty" && <div className="fluxer-picker-state"><Icon name="search" size={24} /><strong>Nenhum GIF encontrado</strong><span>Tente outra busca.</span></div>}
      {((view === "trending" && status === "ready") || (view === "recent" && recent.length > 0)) && <div className="fluxer-gif-grid">{visibleItems.map((gif) => <button type="button" className="fluxer-gif-tile" key={gif.id} onClick={() => selectGif(gif)} title={gif.title}><img src={gif.previewUrl} alt={gif.title} loading="lazy" /></button>)}</div>}
      {view === "recent" && !recent.length && <div className="fluxer-picker-state"><Icon name="clock" size={24} /><strong>Nenhum GIF recente</strong><span>Os GIFs escolhidos aparecem aqui.</span></div>}
    </div>
  </section>;
}
