/** `:name:` 短代码（对标 Vditor / Typora） */
export const EMOJI_ALIASES: Record<string, string> = {
  smile: "😄",
  grin: "😁",
  joy: "😂",
  wink: "😉",
  heart: "❤️",
  brokenheart: "💔",
  fire: "🔥",
  star: "⭐",
  sparkles: "✨",
  tada: "🎉",
  rocket: "🚀",
  check: "✅",
  x: "❌",
  warning: "⚠️",
  bulb: "💡",
  book: "📚",
  pencil: "📝",
  computer: "💻",
  bug: "🐛",
  wrench: "🛠️",
  gear: "⚙️",
  thumbsup: "👍",
  thumbsdown: "👎",
  clap: "👏",
  pray: "🙏",
  muscle: "💪",
  eyes: "👀",
  thinking: "🤔",
  cry: "😢",
  sob: "😭",
  angry: "😡",
  sweat: "😅",
  neutral: "😐",
  ok: "👌",
  mag: "🔍",
  lock: "🔒",
  calendar: "📅",
  zap: "⚡",
  boom: "💥",
  wave: "👋",
};

export function searchEmojiAliases(query: string): Array<{ name: string; emoji: string }> {
  const q = query.trim().toLowerCase().replace(/^:/, "").replace(/:$/, "");
  if (!q) {
    return Object.entries(EMOJI_ALIASES)
      .slice(0, 10)
      .map(([name, emoji]) => ({ name, emoji }));
  }
  return Object.entries(EMOJI_ALIASES)
    .filter(([name]) => name.includes(q))
    .slice(0, 10)
    .map(([name, emoji]) => ({ name, emoji }));
}
