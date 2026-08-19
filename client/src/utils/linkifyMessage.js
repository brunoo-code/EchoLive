import { createElement, Fragment } from "react";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:]}]+$/;

function textNodes(value, keyPrefix) {
  return String(value).split("\n").flatMap((line, index) => [
    index > 0 ? createElement("br", { key: `${keyPrefix}-break-${index}` }) : null,
    line
  ]).filter(Boolean);
}

function linkProps(url, key) {
  const props = { key, href: url };
  let isInternal = false;
  if (typeof window !== "undefined") {
    try {
      isInternal = new URL(url, window.location.origin).origin === window.location.origin;
    } catch {
      isInternal = false;
    }
  }
  if (!isInternal) {
    props.target = "_blank";
    props.rel = "noopener noreferrer";
  }
  return props;
}

export function linkifyMessage(value) {
  const text = String(value || "");
  const nodes = [];
  let cursor = 0;
  let match;
  let index = 0;

  URL_PATTERN.lastIndex = 0;
  while ((match = URL_PATTERN.exec(text))) {
    const rawUrl = match[0];
    let url = rawUrl;
    let suffix = "";
    while (TRAILING_PUNCTUATION.test(url)) {
      suffix = url.slice(-1) + suffix;
      url = url.slice(0, -1);
    }
    if (match.index > cursor) nodes.push(...textNodes(text.slice(cursor, match.index), `text-${index}`));
    nodes.push(createElement("a", linkProps(url, `link-${index}`), url));
    if (suffix) nodes.push(...textNodes(suffix, `suffix-${index}`));
    cursor = match.index + rawUrl.length;
    index += 1;
  }
  if (cursor < text.length) nodes.push(...textNodes(text.slice(cursor), `text-${index}`));
  return createElement(Fragment, null, ...nodes);
}
