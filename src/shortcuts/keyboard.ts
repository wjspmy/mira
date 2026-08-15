const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift"]);
const MODIFIER_ORDER = ["Mod", "Ctrl", "Meta", "Alt", "Shift"];

function canonicalKey(key: string): string {
  if (key === " ") return "Space";
  if (key === "Esc") return "Escape";
  if (key.length === 1) return key.toUpperCase();
  return key[0]?.toUpperCase() + key.slice(1);
}

export function normalizeShortcut(shortcut: string | null | undefined): string | null {
  if (!shortcut) return null;
  const parts = shortcut.split("+").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const key = canonicalKey(parts[parts.length - 1]);
  if (MODIFIER_KEYS.has(key)) return null;

  const modifiers = new Set<string>();
  for (const raw of parts.slice(0, -1)) {
    const part = raw.toLowerCase();
    if (part === "mod" || part === "cmd" || part === "command") modifiers.add("Mod");
    else if (part === "ctrl" || part === "control") modifiers.add("Ctrl");
    else if (part === "meta") modifiers.add("Meta");
    else if (part === "alt" || part === "option") modifiers.add("Alt");
    else if (part === "shift") modifiers.add("Shift");
  }
  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join("+");
}

export function shortcutFromEvent(event: KeyboardEvent): string | null {
  const key = canonicalKey(event.key);
  if (!key || MODIFIER_KEYS.has(key)) return null;

  const modifiers: string[] = [];
  if (event.ctrlKey || event.metaKey) modifiers.push("Mod");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");

  const isPlainCharacter = key.length === 1 && modifiers.length === 0;
  if (isPlainCharacter) return null;
  return [...modifiers, key].join("+");
}

export function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

export function displayShortcut(shortcut: string | null | undefined): string {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return "未设置";
  return normalized
    .replace(/Mod/g, isMacPlatform() ? "⌘" : "Ctrl")
    .replace(/Shift/g, "Shift")
    .replace(/Alt/g, isMacPlatform() ? "⌥" : "Alt")
    .replace(/\+/g, " + ");
}
