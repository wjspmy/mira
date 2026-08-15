import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { normalizeShortcut, shortcutFromEvent } from "../src/shortcuts/keyboard";
import { useShortcutsStore } from "../src/stores/shortcuts";

function keyEvent(init: KeyboardEventInit) {
  return new KeyboardEvent("keydown", init);
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe("keyboard shortcut normalization", () => {
  it("normalizes shortcut strings", () => {
    expect(normalizeShortcut("cmd+shift+o")).toBe("Mod+Shift+O");
    expect(normalizeShortcut("Ctrl+Alt+,")).toBe("Ctrl+Alt+,");
    expect(normalizeShortcut("Mod+`")).toBe("Mod+`");
  });

  it("creates platform-neutral Mod shortcuts from keyboard events", () => {
    expect(shortcutFromEvent(keyEvent({ key: "s", ctrlKey: true }))).toBe("Mod+S");
    expect(shortcutFromEvent(keyEvent({ key: "Tab", metaKey: true, shiftKey: true }))).toBe("Mod+Shift+Tab");
    expect(shortcutFromEvent(keyEvent({ key: "a" }))).toBeNull();
  });
});

describe("shortcuts store", () => {
  it("uses defaults and resolves commands by shortcut", () => {
    const store = useShortcutsStore();
    expect(store.shortcutFor("saveFile")).toBe("Mod+S");
    expect(store.commandForShortcut("Cmd+S")).toBe("saveFile");
  });

  it("stores custom shortcuts and persists them", () => {
    const store = useShortcutsStore();
    expect(store.setShortcut("saveFile", "Mod+Alt+S")).toBeNull();
    expect(store.shortcutFor("saveFile")).toBe("Mod+Alt+S");

    setActivePinia(createPinia());
    const reloaded = useShortcutsStore();
    expect(reloaded.shortcutFor("saveFile")).toBe("Mod+Alt+S");
  });

  it("rejects conflicts and can reset defaults", () => {
    const store = useShortcutsStore();
    expect(store.setShortcut("openFile", "Mod+S")).toBe("saveFile");
    expect(store.shortcutFor("openFile")).toBe("Mod+O");

    expect(store.setShortcut("openFile", "Mod+Alt+O")).toBeNull();
    store.resetShortcut("openFile");
    expect(store.shortcutFor("openFile")).toBe("Mod+O");

    store.setShortcut("saveFile", "Mod+Alt+S");
    store.resetAll();
    expect(store.shortcutFor("saveFile")).toBe("Mod+S");
  });
});
