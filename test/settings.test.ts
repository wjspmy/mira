import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "../src/stores/settings";
import { CUSTOM_CSS_STYLE_ID, clearCustomCss, scopedEditorCss, upsertCustomCss } from "../src/editor/custom-css";

const storage = new Map<string, string>();
const headChildren: Array<{ id: string; textContent: string; remove: () => void }> = [];

function installDocumentStub() {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      head: {
        appendChild: (node: any) => headChildren.push(node),
      },
      createElement: () => ({
        id: "",
        textContent: "",
        remove() {
          const index = headChildren.indexOf(this as any);
          if (index >= 0) headChildren.splice(index, 1);
        },
      }),
      getElementById: (id: string) => headChildren.find((node) => node.id === id) ?? null,
      querySelectorAll: (selector: string) => {
        if (selector === `#${CUSTOM_CSS_STYLE_ID}`) return headChildren.filter((node) => node.id === CUSTOM_CSS_STYLE_ID);
        return [];
      },
    },
  });
}

beforeEach(() => {
  storage.clear();
  headChildren.length = 0;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  installDocumentStub();
  setActivePinia(createPinia());
});

describe("settings store", () => {
  it("persists a normalized custom css path", () => {
    const store = useSettingsStore();
    expect(store.customCssPath).toBe("");

    store.setCustomCssPath(String.raw`\\?\C:\theme\mira.css`);
    expect(store.customCssPath).toBe(String.raw`C:\theme\mira.css`);
    expect(JSON.parse(storage.get("mira-settings") || "{}")).toMatchObject({
      customCssPath: String.raw`C:\theme\mira.css`,
      customCssVersion: 1,
    });

    setActivePinia(createPinia());
    expect(useSettingsStore().customCssPath).toBe(String.raw`C:\theme\mira.css`);
  });

  it("clears custom css path", () => {
    const store = useSettingsStore();
    store.setCustomCssPath(String.raw`C:\theme\mira.css`);
    store.clearCustomCssPath();
    expect(store.customCssPath).toBe("");
    expect(JSON.parse(storage.get("mira-settings") || "{}")).toMatchObject({ customCssPath: "", customCssVersion: 2 });
  });

  it("clamps and persists editor preferences", () => {
    const store = useSettingsStore();
    store.patch({ editorFontSize: 99, autoSaveDelayMs: 50, imageStrategy: "relative" });
    expect(store.editorFontSize).toBe(28);
    expect(store.autoSaveDelayMs).toBe(300);
    expect(store.imageStrategy).toBe("relative");

    store.setTheme("dark");
    expect(store.theme).toBe("dark");
    expect(storage.get("mira-theme")).toBe("dark");
    expect(store.resolveTheme(false)).toBe("dark");

    store.setTheme("system");
    expect(store.resolveTheme(true)).toBe("dark");
    expect(store.resolveTheme(false)).toBe("light");
  });
});

describe("custom css injection", () => {
  it("scopes selectors to editor surfaces and injects one style tag", () => {
    upsertCustomCss("h1 { color: red; }\n:root { --content-width: 900px; }");
    const style = document.getElementById(CUSTOM_CSS_STYLE_ID);
    expect(style?.textContent).toContain(".editor .ProseMirror h1, .source-editor h1 { color: red; }");
    expect(style?.textContent).toContain(":root { --content-width: 900px; }");

    upsertCustomCss("p { line-height: 2; }");
    expect(document.querySelectorAll(`#${CUSTOM_CSS_STYLE_ID}`).length).toBe(1);
    expect(document.getElementById(CUSTOM_CSS_STYLE_ID)?.textContent).toContain(".editor .ProseMirror p, .source-editor p { line-height: 2; }");

    clearCustomCss();
    expect(document.getElementById(CUSTOM_CSS_STYLE_ID)).toBeNull();
  });

  it("keeps at-rules while scoping their nested selectors", () => {
    expect(scopedEditorCss("@media print { h1 { color: black; } }")).toContain(
      "@media print { .editor .ProseMirror h1, .source-editor h1 { color: black; } }",
    );
  });
});
