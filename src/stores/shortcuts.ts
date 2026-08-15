import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { SHORTCUT_COMMANDS, type ShortcutCommandId } from "../shortcuts/registry";
import { normalizeShortcut } from "../shortcuts/keyboard";

const SHORTCUTS_KEY = "mira-shortcuts";
type ShortcutOverrides = Partial<Record<ShortcutCommandId, string | null>>;

function loadOverrides(): ShortcutOverrides {
  try {
    const raw = JSON.parse(localStorage.getItem(SHORTCUTS_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const overrides: ShortcutOverrides = {};
    for (const command of SHORTCUT_COMMANDS) {
      if (!(command.id in raw)) continue;
      const value = raw[command.id];
      const normalized = typeof value === "string" ? normalizeShortcut(value) : null;
      overrides[command.id] = normalized;
    }
    return overrides;
  } catch {
    return {};
  }
}

export const useShortcutsStore = defineStore("shortcuts", () => {
  const overrides = ref<ShortcutOverrides>(loadOverrides());

  const bindings = computed<Record<ShortcutCommandId, string | null>>(() => {
    const result = {} as Record<ShortcutCommandId, string | null>;
    for (const command of SHORTCUT_COMMANDS) {
      result[command.id] = command.id in overrides.value
        ? overrides.value[command.id] ?? null
        : normalizeShortcut(command.defaultShortcut);
    }
    return result;
  });

  function persist() {
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(overrides.value));
  }

  function shortcutFor(commandId: ShortcutCommandId): string | null {
    return bindings.value[commandId] ?? null;
  }

  function commandForShortcut(shortcut: string | null, except?: ShortcutCommandId): ShortcutCommandId | null {
    const normalized = normalizeShortcut(shortcut);
    if (!normalized) return null;
    for (const command of SHORTCUT_COMMANDS) {
      if (command.id === except) continue;
      if (bindings.value[command.id] === normalized) return command.id;
    }
    return null;
  }

  function setShortcut(commandId: ShortcutCommandId, shortcut: string): ShortcutCommandId | null {
    const normalized = normalizeShortcut(shortcut);
    if (!normalized) return null;
    const conflict = commandForShortcut(normalized, commandId);
    if (conflict) return conflict;
    overrides.value = { ...overrides.value, [commandId]: normalized };
    persist();
    return null;
  }

  function resetShortcut(commandId: ShortcutCommandId) {
    const next = { ...overrides.value };
    delete next[commandId];
    overrides.value = next;
    persist();
  }

  function resetAll() {
    overrides.value = {};
    localStorage.removeItem(SHORTCUTS_KEY);
  }

  return { overrides, bindings, shortcutFor, commandForShortcut, setShortcut, resetShortcut, resetAll };
});
