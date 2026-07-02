<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { MathInline, MathBlock } from "./editor/math";
import { serializeDocToMarkdown } from "./editor/serialize";
import { useWorkspaceStore } from "./stores/workspace";
import { useSessionStore } from "./stores/session";
import FileTreeNode from "./components/FileTree.vue";
import Tabs from "./components/Tabs.vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog, ask } from "@tauri-apps/plugin-dialog";

const ws = useWorkspaceStore();
const session = useSessionStore();
const status = ref("就绪");

// 主题：浅/深，持久化到 localStorage，默认跟随系统
const theme = ref<"light" | "dark">(
  (localStorage.getItem("mira-theme") as "light" | "dark") ||
    (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
);
function applyTheme(t: string) {
  document.documentElement.dataset.theme = t;
}
function toggleTheme() {
  theme.value = theme.value === "light" ? "dark" : "light";
}
watch(theme, (t) => {
  applyTheme(t);
  localStorage.setItem("mira-theme", t);
});
applyTheme(theme.value);

const lowlight = createLowlight(common);
let loading = false; // 程序化 setContent 时抑制 onUpdate，避免误标 dirty

const editor = useEditor({
  extensions: [
    StarterKit.configure({ codeBlock: false }),
    CodeBlockLowlight.configure({ lowlight }),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false }),
    MathInline,
    MathBlock,
    Markdown.configure({ html: false, breaks: true }),
  ],
  content: "",
  onUpdate: () => {
    if (loading) return;
    session.markActiveDirty(true);
    scheduleAutosave();
  },
});

function getMarkdown(): string {
  const doc = editor.value?.state.doc;
  if (!doc) return "";
  return serializeDocToMarkdown(doc);
}

function loadIntoEditor(md: string) {
  loading = true;
  editor.value?.commands.setContent(md || "");
  loading = false;
}

function basename(p: string) {
  const a = p.split(/[\\/]/);
  return a[a.length - 1];
}

const activeDoc = computed(() => session.activeDoc);
const filePath = computed(() => session.activeDoc?.filePath ?? null);
const dirty = computed(() => session.activeDoc?.dirty ?? false);

function uuid() {
  return (crypto as any).randomUUID?.() ?? String(Date.now()) + Math.random();
}

// 切换标签：把当前编辑器内容序列化存入旧 doc，加载新 doc 的 rawMd
watch(
  () => session.activeId,
  (newId, oldId) => {
    if (newId === oldId) return;
    // 取消待执行的自动保存，避免它把切换后的新内容误写到旧 doc 的文件
    if (timer) { clearTimeout(timer); timer = null; }
    // 序列化旧 doc（编辑器此刻仍是旧内容）
    if (oldId) {
      const old = session.docs.find((d) => d.id === oldId);
      if (old) old.rawMd = getMarkdown();
    }
    // 加载新 doc
    if (newId) {
      const next = session.docs.find((d) => d.id === newId);
      loadIntoEditor(next?.rawMd ?? "");
    } else {
      loadIntoEditor("");
    }
  },
);

function newDoc() {
  const id = uuid();
  session.addDoc({ id, filePath: null, rawMd: "# 新文档\n\n开始写作…", dirty: false });
  session.setActive(id);
}

async function openFile(path?: string) {
  if (!path) {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
    });
    if (!selected) return;
    path = typeof selected === "string" ? selected : (selected as any).path;
    if (!path) return;
  }
  try {
    const text = await invoke<string>("read_text_file", { path });
    const existing = session.findDocByPath(path);
    if (existing) {
      session.setActive(existing.id);
      return;
    }
    const id = uuid();
    session.addDoc({ id, filePath: path, rawMd: text, dirty: false });
    session.setActive(id);
    status.value = `已打开 ${path}`;
  } catch (e) {
    status.value = `打开失败：${e}`;
  }
}

async function saveFile() {
  const doc = session.activeDoc;
  if (!doc) return;
  const md = getMarkdown();
  let path = doc.filePath;
  if (!path) {
    path = await saveDialog({
      defaultPath: "untitled.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!path) return;
    doc.filePath = path;
  }
  try {
    await invoke("write_text_file", { path, content: md });
    doc.rawMd = md;
    doc.dirty = false;
    status.value = `已保存 ${path}`;
  } catch (e) {
    status.value = `保存失败：${e}`;
  }
}

async function closeDoc(id: string) {
  const doc = session.docs.find((d) => d.id === id);
  if (doc?.dirty && !(await ask("该文档有未保存修改，确认关闭？", { title: "Mira", kind: "warning" }))) {
    return;
  }
  const idx = session.docs.findIndex((d) => d.id === id);
  if (idx < 0) return;
  const wasActive = session.activeId === id;
  const neighbor = wasActive ? session.docs[idx + 1] || session.docs[idx - 1] || null : null;
  session.removeDoc(id);
  if (wasActive) {
    session.setActive(neighbor ? neighbor.id : null);
    // watch 会处理编辑器切换（旧 doc 已移除，跳过序列化，加载 neighbor 或清空）
  }
}

// 防抖自动保存（仅对已命名文档）
let timer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutosave() {
  const doc = session.activeDoc;
  if (!doc || !doc.filePath) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    // 若已切换到别的文档，跳过（切换时旧 doc 内容已序列化进 rawMd）
    if (doc !== session.activeDoc) return;
    try {
      const md = getMarkdown();
      await invoke("write_text_file", { path: doc.filePath!, content: md });
      doc.rawMd = md;
      doc.dirty = false;
      status.value = `已自动保存 ${doc.filePath}`;
    } catch (e) {
      status.value = `自动保存失败：${e}`;
    }
  }, 1000);
}

watch([filePath, dirty], () => {
  const name = filePath.value ? basename(filePath.value) : activeDoc.value ? "未命名" : "Mira";
  document.title = dirty.value ? `Mira — ${name} •` : `Mira — ${name}`;
});

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
  editor.value?.destroy();
});
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <button @click="ws.openFolder()">打开文件夹</button>
      <button @click="openFile()">打开</button>
      <button @click="newDoc">新建</button>
      <button @click="saveFile">保存</button>
      <button class="theme-btn" @click="toggleTheme" :title="theme === 'light' ? '切换深色' : '切换浅色'">{{ theme === "light" ? "🌙" : "☀️" }}</button>
      <span class="path">{{ filePath ?? "未命名" }}</span>
      <span class="dot" :class="{ dirty }">{{ dirty ? "● 未保存" : "已保存" }}</span>
    </header>
    <Tabs v-if="session.docs.length" @close="closeDoc" />
    <div class="body">
      <aside class="sidebar" v-if="ws.rootPath">
        <div class="sidebar-header" :title="ws.rootPath">{{ ws.rootName }}</div>
        <div class="tree">
          <FileTreeNode
            v-for="child in ws.childrenOf(ws.rootPath) || []"
            :key="child.path"
            :node="child"
            :depth="0"
            @open-file="openFile"
          />
          <div v-if="ws.childrenOf(ws.rootPath) === null" class="tree-loading">加载中…</div>
        </div>
      </aside>
      <EditorContent v-if="editor" :editor="editor" class="mira-editor editor" />
    </div>
    <footer class="status">{{ status }}</footer>
  </div>
</template>
