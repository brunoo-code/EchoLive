const GIF_HOST_PATTERNS = [
  "giphy.com",
  "media.giphy.com",
  "tenor.com",
  "media.tenor.com",
  "c.tenor.com"
];

const TRAILING_PUNCTUATION = /[),.;!?]+$/;

function cleanUrl(value) {
  return value.replace(TRAILING_PUNCTUATION, "");
}

function isGifUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    return pathname.endsWith(".gif") || GIF_HOST_PATTERNS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function extractInlineGifUrls(content) {
  if (!content || typeof content !== "string") return [];
  const urls = content.match(/https?:\/\/[^\s<>"']+/gi) || [];
  return [...new Set(urls.map(cleanUrl).filter(isGifUrl))];
}
