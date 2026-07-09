// 会话 store（设计 §15.1）：打开的文档列表 + 活动标签
import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface Doc {
  id: string;
  filePath: string | null; // null = 未命名新文档
  rawMd: string; // 最近一次序列化的 Markdown（保存/外部重载时更新）
  dirty: boolean; // 编辑器是否有未保存改动
  scrollTop?: number; // 编辑区滚动位置（仅内存态）
  // ProseMirror 文档 JSON 快照（不可变）。切入时据此新建 EditorState（清空历史，独立 undo/redo）
  docJSON?: any | null;
}

export interface SessionSnapshot {
  openPaths: string[];
  activePath: string | null;
}

const SESSION_KEY = "mira-session";

function normPath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
}

export const useSessionStore = defineStore("session", () => {
  const docs = ref<Doc[]>([]);
  const activeId = ref<string | null>(null);
  const activeDoc = computed(() => docs.value.find((d) => d.id === activeId.value) ?? null);
  const dirtyCount = computed(() => docs.value.filter((d) => d.dirty).length);

  function addDoc(doc: Doc) {
    docs.value.push(doc);
  }
  function removeDoc(id: string) {
    const idx = docs.value.findIndex((d) => d.id === id);
    if (idx >= 0) docs.value.splice(idx, 1);
  }
  function setActive(id: string | null) {
    activeId.value = id;
  }
  function findDocByPath(path: string) {
    const np = normPath(path);
    return docs.value.find((d) => d.filePath && normPath(d.filePath) === np) ?? null;
  }
  function markActiveDirty(v: boolean) {
    const d = activeDoc.value;
    if (d) d.dirty = v;
  }
  function updateActiveMd(md: string) {
    const d = activeDoc.value;
    if (d) d.rawMd = md;
  }

  function snapshot(): SessionSnapshot {
    const seen = new Set<string>();
    const openPaths: string[] = [];
    for (const d of docs.value) {
      if (!d.filePath) continue;
      const key = normPath(d.filePath);
      if (seen.has(key)) continue;
      seen.add(key);
      openPaths.push(d.filePath);
    }
    return { openPaths, activePath: activeDoc.value?.filePath ?? null };
  }

  function persistSession() {
    localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot()));
  }

  function loadSnapshot(): SessionSnapshot {
    try {
      const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (!raw || !Array.isArray(raw.openPaths)) return { openPaths: [], activePath: null };
      const openPaths = raw.openPaths.filter((p: unknown) => typeof p === "string");
      const activePath = typeof raw.activePath === "string" ? raw.activePath : null;
      return { openPaths, activePath };
    } catch {
      return { openPaths: [], activePath: null };
    }
  }

  return {
    docs,
    activeId,
    activeDoc,
    dirtyCount,
    addDoc,
    removeDoc,
    setActive,
    findDocByPath,
    markActiveDirty,
    updateActiveMd,
    snapshot,
    persistSession,
    loadSnapshot,
  };
});
