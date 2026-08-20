import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useEditorModeStore } from "../src/stores/editor-mode";
import { SHORTCUT_COMMAND_BY_ID } from "../src/shortcuts/registry";
import { buildAppMenuGroups } from "../src/menus/appMenu";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  setActivePinia(createPinia());
});

describe("editor mode store", () => {
  it("toggles source mode and persists it", () => {
    const store = useEditorModeStore();

    expect(store.mode).toBe("visual");
    expect(store.toggleMode()).toBe("source");
    expect(store.mode).toBe("source");
    expect(storage.get("mira-editor-mode")).toBe("source");

    setActivePinia(createPinia());
    const reloaded = useEditorModeStore();
    expect(reloaded.mode).toBe("source");
  });

  it("normalizes invalid persisted values back to visual mode", () => {
    storage.set("mira-editor-mode", "invalid");
    const store = useEditorModeStore();
    expect(store.mode).toBe("visual");
  });
});


it("exposes the source-mode toggle through the view menu", () => {
  expect(SHORTCUT_COMMAND_BY_ID.toggleSourceMode.defaultShortcut).toBe("Mod+Shift+M");

  const visual = buildAppMenuGroups({
    recentPaths: [],
    shortcuts: { toggleSourceMode: "Ctrl + Shift + M" },
    hasActiveDoc: true,
    hasOpenTabs: true,
    editorMode: "visual",
  });
  expect(visual.find((group) => group.id === "view")?.items[0]).toMatchObject({
    id: "toggleSourceMode",
    label: "切换到源码模式",
    shortcut: "Ctrl + Shift + M",
    active: false,
  });

  const source = buildAppMenuGroups({
    recentPaths: [],
    shortcuts: {},
    hasActiveDoc: true,
    hasOpenTabs: true,
    editorMode: "source",
  });
  expect(source.find((group) => group.id === "view")?.items[0]).toMatchObject({
    label: "切换到所见即所得",
    active: true,
  });
});
