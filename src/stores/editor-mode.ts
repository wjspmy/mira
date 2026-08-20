import { defineStore } from "pinia";
import { ref } from "vue";

export type EditorMode = "visual" | "source";

const EDITOR_MODE_KEY = "mira-editor-mode";

function loadMode(): EditorMode {
  try {
    return localStorage.getItem(EDITOR_MODE_KEY) === "source" ? "source" : "visual";
  } catch {
    return "visual";
  }
}

export const useEditorModeStore = defineStore("editorMode", () => {
  const mode = ref<EditorMode>(loadMode());

  function setMode(next: EditorMode) {
    mode.value = next;
    try {
      localStorage.setItem(EDITOR_MODE_KEY, next);
    } catch {
      // Persistence is best-effort; the editor mode remains usable in memory.
    }
  }

  function toggleMode(): EditorMode {
    const next = mode.value === "visual" ? "source" : "visual";
    setMode(next);
    return next;
  }

  return { mode, setMode, toggleMode };
});
