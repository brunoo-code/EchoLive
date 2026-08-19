import { useMemo, useState } from "react";

const GROUPS = [
  ["Recentes", "😀 😂 😊 ❤️ 👍".split(" ")],
  ["Pessoas", "😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫡 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🤢 🤮 🤧 😷 🤒 🤕".split(" ")],
  ["Gestos", "👋 🤚 🖐️ ✋ 🖖 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 👃 🧠 👀 👁️ 👅 👄 💋".split(" ")],
  ["Símbolos", "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✨ ⭐ 🌟 💫 🔥 💥 💯 ✅ ☑️ ❌ ❗ ❓ ⁉️ 💬 🗨️ 🗯️ 💭 💤 🎵 🎶".split(" ")],
  ["Natureza", "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦄 🐝 🦋 🐌 🐞 🐜 🕷️ 🐢 🐍 🦎 🐙 🐠 🐟 🐳 🐋 🌸 🌹 🌺 🌻 🌼 🌷 🌱 🌿 🍀 🍃 🌵 🌴 🌈 ☀️ 🌤️ ☁️ 🌧️ ⛈️ ❄️ 🌙 🌎".split(" ")],
  ["Comida", "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥕 🌽 🌶️ 🥒 🥬 🥔 🍞 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🍗 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍿 🍜 🍝 🍣 🍤 🍚 🍙 🍰 🎂 🧁 🍪 🍩 🍫 🍬 🍭 ☕ 🍵 🧃 🥤".split(" ")],
  ["Atividades", "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🪁 🏓 🏸 🥊 🥋 🛹 🛼 🏆 🥇 🥈 🥉 🎮 🕹️ 🎲 ♟️ 🎯 🎳 🎨 🎭 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎸 🎺 🎻 🎉 🎊 🎈 🎁".split(" ")],
  ["Viagem", "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚲 🛴 🛵 ✈️ 🛫 🛬 🚀 🛸 🚁 🚢 ⛵ 🚂 🚉 🗺️ 🧭 🏠 🏢 🏥 🏫 🏰 🗽 🗼 🏖️ 🏝️ 🏜️ 🏕️ ⛺ 🌋 🌍 🌎 🌏".split(" ")],
  ["Objetos", "💡 🔦 🕯️ 📱 💻 ⌨️ 🖥️ 🖨️ 📷 📸 🎥 📺 📻 🎙️ ⏰ ⌚ 📌 📍 📎 ✂️ 🔒 🔑 🔨 🔧 ⚙️ 🧰 🧲 💊 📚 📖 📝 ✏️ 📅 💳 💰 💎 🎒 🧳 ☂️ ☔ ☁️ 🛒".split(" ")],
  ["Bandeiras", "🇧🇷 🇵🇹 🇺🇸 🇬🇧 🇯🇵 🇫🇷 🇩🇪 🇪🇸 🇮🇹 🇨🇦 🇦🇺 🇲🇽 🇦🇷 🇨🇱 🇨🇴 🇵🇪 🇺🇾 🇵🇾 🇮🇳 🇨🇳 🇰🇷 🇺🇦 🇵🇱 🇳🇱 🇸🇪 🇳🇴 🇫🇮 🇮🇪 🇿🇦 🇪🇬".split(" ")]
];

const RECENTS_KEY = "echolive.recentEmojis";

export default function EmojiPicker({ onSelect }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Recentes");
  const recent = useMemo(() => { try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]"); } catch { return []; } }, []);
  const emojis = group === "Recentes" ? recent : GROUPS.find(([name]) => name === group)?.[1] || [];
  const filtered = query.trim() ? GROUPS.flatMap(([, values]) => values).filter((emoji, index, all) => all.indexOf(emoji) === index) : emojis;
  function choose(emoji) {
    const next = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, 24);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
    onSelect?.(emoji);
  }
  return <div className="emoji-picker emoji-picker-rich" role="dialog" aria-label="Escolher emoji">
    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar emoji" aria-label="Buscar emoji" />
    <div className="emoji-category-tabs">{GROUPS.map(([name]) => <button type="button" key={name} className={group === name && !query ? "is-active" : ""} onClick={() => { setGroup(name); setQuery(""); }}>{name}</button>)}</div>
    <div className="emoji-grid">{filtered.length ? filtered.map((emoji, index) => <button type="button" key={`${emoji}-${index}`} onClick={() => choose(emoji)} aria-label={`Inserir ${emoji}`}>{emoji}</button>) : <span className="emoji-empty">Nenhum emoji encontrado.</span>}</div>
  </div>;
}
