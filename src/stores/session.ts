// 会话 store（设计 §15.1）：打开的文档列表 + 活动标签
import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface Doc {
  id: string;
  filePath: string | null; // null = 未命名新文档
  rawMd: string; // 最近一次序列化的 Markdown（保存/外部重载时更新）
  dirty: boolean; // 编辑器是否有未保存改动
  // ProseMirror 文档 JSON 快照（不可变）。切入时据此新建 EditorState（清空历史，独立 undo/redo）
  docJSON?: any | null;
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
    return docs.value.find((d) => d.filePath === path) ?? null;
  }
  function markActiveDirty(v: boolean) {
    const d = activeDoc.value;
    if (d) d.dirty = v;
  }
  function updateActiveMd(md: string) {
    const d = activeDoc.value;
    if (d) d.rawMd = md;
  }

  return { docs, activeId, activeDoc, dirtyCount, addDoc, removeDoc, setActive, findDocByPath, markActiveDirty, updateActiveMd };
});
