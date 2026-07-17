<script setup lang="ts">
import { ref, watch, onBeforeUnmount, onMounted, computed, nextTick } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import { EditorState } from "@tiptap/pm/state";
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
import { MiraImage } from "./editor/image";
import { useWorkspaceStore, type FileNode } from "./stores/workspace";
import { useSessionStore } from "./stores/session";
import { useRecentStore } from "./stores/recent";
import FileTreeNode from "./components/FileTree.vue";
import Tabs from "./components/Tabs.vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog, ask } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow, type CloseRequestedEvent } from "@tauri-apps/api/window";

const ws = useWorkspaceStore();
const session = useSessionStore();
const recent = useRecentStore();
const status = ref("就绪");
let restoringSession = false;

type ContextMenuState = {
  x: number;
  y: number;
  node: FileNode | null;
};
const contextMenu = ref<ContextMenuState | null>(null);

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
let loading = false; // Suppress onUpdate during programmatic editor state changes.
let undoFloorMd = ""; // Fallback guard: prevent undo from crossing the current tab baseline.

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
    MiraImage,
    Markdown.configure({ html: false, breaks: true }),
  ],
  content: "",
  editorProps: {
    handleKeyDown: (_view, event) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        // setContent 会留下跨文档 history。当前内容已回到本标签加载基线时，禁止继续 undo 穿透到上一个标签。
        if (getMarkdown() === undoFloorMd) {
          event.preventDefault();
          return true;
        }
      }
      return false;
    },
  },
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

function resetCurrentHistory() {
  const ed = editor.value;
  if (!ed) return;
  const cleanState = EditorState.create({
    schema: ed.schema,
    doc: ed.state.doc,
    plugins: ed.state.plugins,
  });
  ed.view.updateState(cleanState);
}

function loadIntoEditor(md: string) {
  const ed = editor.value;
  if (!ed) return;
  loading = true;
  try {
    ed.commands.setContent(md || "");
    resetCurrentHistory();
    undoFloorMd = getMarkdown();
  } finally {
    loading = false;
  }
}

function snapshotEditorDoc(id: string | null = session.activeId) {
  if (!id || !editor.value) return;
  const doc = session.docs.find((d) => d.id === id);
  if (!doc) return;
  doc.rawMd = getMarkdown();
}

function basename(p: string) {
  const a = p.split(/[\\/]/);
  return a[a.length - 1];
}

function normPath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
}

function isSameOrChildPath(path: string, root: string): boolean {
  const p = normPath(path);
  const r = normPath(root);
  return p === r || p.startsWith(r + "/");
}

function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  const p = normPath(path);
  const old = normPath(oldPrefix);
  if (p === old) return newPrefix;
  if (!p.startsWith(old + "/")) return path;
  return newPrefix.replace(/[\\/]+$/, "") + path.slice(oldPrefix.length);
}

function dirname(p: string): string {
  const sep = p.includes("\\") ? "\\" : "/";
  return p.lastIndexOf(sep) >= 0 ? p.slice(0, p.lastIndexOf(sep)) : "";
}

function syncEditorDocDir(path: string | null | undefined) {
  if (!editor.value) return;
  editor.value.storage.miraDocDir = path ? dirname(path) || undefined : undefined;
}

function persistSessionSoon() {
  if (!restoringSession) session.persistSession();
}

function editorScroller(): HTMLElement | null {
  return document.querySelector(".editor");
}

function saveDocScroll(id: string | null) {
  if (!id) return;
  const doc = session.docs.find((d) => d.id === id);
  const scroller = editorScroller();
  if (doc && scroller) doc.scrollTop = scroller.scrollTop;
}

async function restoreDocScroll(id: string | null) {
  await nextTick();
  const scroller = editorScroller();
  if (!scroller) return;
  const doc = id ? session.docs.find((d) => d.id === id) : null;
  scroller.scrollTop = doc?.scrollTop ?? 0;
}

const activeDoc = computed(() => session.activeDoc);
const filePath = computed(() => session.activeDoc?.filePath ?? null);
const dirty = computed(() => session.activeDoc?.dirty ?? false);

function uuid() {
  return (crypto as any).randomUUID?.() ?? String(Date.now()) + Math.random();
}

// 显式切换：先同步保存旧 doc 的 markdown，再 setActive，再加载目标 doc 的快照。
// 每个 tab 持有独立 rawMd/scrollTop；loadIntoEditor() 会重建当前 EditorState，避免 undo/redo 跨标签串历史。
async function switchTo(newId: string | null) {
  const oldId = session.activeId;
  if (newId === oldId) return;
  if (timer) { clearTimeout(timer); timer = null; }
  // 保存 outgoing：序列化为 markdown 字符串（不可变）；已命名 dirty 文档切走前立即落盘，避免防抖保存被取消。
  saveDocScroll(oldId);
  if (oldId && editor.value) {
    const old = session.docs.find((d) => d.id === oldId);
    if (old) {
      snapshotEditorDoc(oldId);
      if (old.filePath && old.dirty) {
        try {
          await invoke("write_text_file", { path: old.filePath, content: old.rawMd });
          old.dirty = false;
          status.value = `已自动保存 ${old.filePath}`;
        } catch (e) {
          status.value = `自动保存失败：${e}`;
        }
      }
    }
  }
  session.setActive(newId);
  // Restore from the target tab's own Markdown snapshot. This keeps same-name tabs isolated
  // and clears history so undo cannot cross into the previous tab.
  if (newId && editor.value) {
    const next = session.docs.find((d) => d.id === newId);
    syncEditorDocDir(next?.filePath);
    if (next) loadIntoEditor(next.rawMd || "");
  } else if (editor.value) {
    syncEditorDocDir(null);
    loadIntoEditor("");
  }
  await restoreDocScroll(newId);
  persistSessionSoon();
}

function newDoc() {
  const id = uuid();
  session.addDoc({ id, filePath: null, rawMd: "# 新文档\n\n开始写作…", dirty: false });
  switchTo(id);
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
      await switchTo(existing.id);
      return;
    }
    const id = uuid();
    session.addDoc({ id, filePath: path, rawMd: text, dirty: false });
    // 监听该文件所在目录（散文件也要监听外部改动，设计 §16.4；watch 命令幂等）
    const sep = path.includes("\\") ? "\\" : "/";
    const dir = path.lastIndexOf(sep) >= 0 ? path.slice(0, path.lastIndexOf(sep)) : "";
    if (dir) {
      try { await invoke("watch", { root: dir }); } catch { /* ignore */ }
    }
    await switchTo(id);
    recent.addRecent(path);
    persistSessionSoon();
    status.value = `已打开 ${path}`;
  } catch (e) {
    // 文件可能已删除/移动，从最近列表清理
    if (path) recent.removeRecent(path);
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
    syncEditorDocDir(path);
    const dir = dirname(path);
    if (dir) {
      try { await invoke("watch", { root: dir }); } catch { /* ignore */ }
    }
  }
  try {
    await invoke("write_text_file", { path, content: md });
    doc.rawMd = md;
    doc.dirty = false;
    persistSessionSoon();
    status.value = `已保存 ${path}`;
  } catch (e) {
    status.value = `保存失败：${e}`;
  }
}

async function createWorkspaceFile(dir = ws.rootPath) {
  if (!dir) {
    status.value = "请先打开文件夹";
    return;
  }
  const name = window.prompt("文件名", "untitled.md");
  if (name === null) return;
  try {
    const path = await ws.createFile(dir, name);
    await openFile(path);
    status.value = `已新建文件 ${path}`;
  } catch (e) {
    const message = `新建文件失败：${e instanceof Error ? e.message : String(e)}`;
    status.value = message;
    window.alert(message);
  }
}

async function createWorkspaceFolder(dir = ws.rootPath) {
  if (!dir) {
    status.value = "请先打开文件夹";
    return;
  }
  const name = window.prompt("文件夹名", "新建文件夹");
  if (name === null) return;
  try {
    const path = await ws.createFolder(dir, name);
    status.value = `已新建文件夹 ${path}`;
  } catch (e) {
    const message = `新建文件夹失败：${e instanceof Error ? e.message : String(e)}`;
    status.value = message;
    window.alert(message);
  }
}

async function renameWorkspaceNode(node: FileNode) {
  const newName = window.prompt(node.isDir ? "新文件夹名" : "新文件名", node.name);
  if (newName === null || newName.trim() === node.name) return;
  const oldPath = node.path;
  try {
    const newPath = await ws.renameNode(node, newName);
    const affectedDocs = session.docs.filter((d) => d.filePath && isSameOrChildPath(d.filePath, oldPath));
    const changedPaths: string[] = [];
    for (const doc of affectedDocs) {
      const nextPath = replacePathPrefix(doc.filePath!, oldPath, newPath);
      doc.filePath = nextPath;
      changedPaths.push(nextPath);
      if (session.activeId === doc.id) syncEditorDocDir(doc.filePath);
    }
    const deduped = await dedupeOpenDocsForPaths(changedPaths.length ? changedPaths : [newPath]);
    if (affectedDocs.length || deduped) persistSessionSoon();
    recent.renameRecent(oldPath, newPath);
    status.value = `已重命名为 ${basename(newPath)}`;
  } catch (e) {
    const message = `重命名失败：${e instanceof Error ? e.message : String(e)}`;
    status.value = message;
    window.alert(message);
  }
}

async function moveWorkspaceNode(node: FileNode) {
  const selected = await openDialog({ directory: true, multiple: false, defaultPath: ws.rootPath ?? undefined });
  if (!selected) return;
  const targetDir = typeof selected === "string" ? selected : (selected as any).path;
  if (!targetDir) return;
  const oldPath = node.path;
  try {
    const newPath = await ws.moveNodeToDir(node, targetDir);
    const affectedDocs = session.docs.filter((d) => d.filePath && isSameOrChildPath(d.filePath, oldPath));
    const changedPaths: string[] = [];
    for (const doc of affectedDocs) {
      const nextPath = replacePathPrefix(doc.filePath!, oldPath, newPath);
      doc.filePath = nextPath;
      changedPaths.push(nextPath);
      if (session.activeId === doc.id) syncEditorDocDir(doc.filePath);
    }
    const deduped = await dedupeOpenDocsForPaths(changedPaths.length ? changedPaths : [newPath]);
    if (affectedDocs.length || deduped) persistSessionSoon();
    recent.renameRecent(oldPath, newPath);
    status.value = `已移动到 ${targetDir}`;
  } catch (e) {
    const message = `移动失败：${e instanceof Error ? e.message : String(e)}`;
    status.value = message;
    window.alert(message);
  }
}

async function deleteWorkspaceNode(node: FileNode) {
  const affectedDocs = session.docs.filter((d) => d.filePath && isSameOrChildPath(d.filePath, node.path));
  const dirtyCount = affectedDocs.filter((d) => d.dirty).length;
  const message = node.isDir
    ? `确认将文件夹 "${node.name}" 及其中所有内容移到回收站？${dirtyCount ? `\n包含 ${dirtyCount} 个未保存的已打开文档。` : ""}`
    : `确认将文件 "${node.name}" 移到回收站？${dirtyCount ? "\n该文件有未保存修改。" : ""}`;
  const ok = await ask(message, { title: "Mira", kind: "warning" });
  if (!ok) return;

  try {
    const affectedIds = new Set(affectedDocs.map((d) => d.id));
    const activeWillClose = session.activeId ? affectedIds.has(session.activeId) : false;
    const nextDoc = activeWillClose ? session.docs.find((d) => !affectedIds.has(d.id)) ?? null : null;
    await ws.deleteNode(node);
    for (const doc of affectedDocs) {
      session.removeDoc(doc.id);
    }
    recent.removeRecentUnder(node.path);
    if (activeWillClose) {
      await switchTo(nextDoc?.id ?? null);
    } else {
      persistSessionSoon();
    }
    status.value = `已移到回收站 ${node.name}`;
  } catch (e) {
    const error = `移到回收站失败：${e instanceof Error ? e.message : String(e)}`;
    status.value = error;
    window.alert(error);
  }
}

function contextMenuPosition(event: MouseEvent) {
  const menuWidth = 170;
  const menuHeight = 240;
  const gap = 8;
  return {
    x: Math.max(gap, Math.min(event.clientX, window.innerWidth - menuWidth - gap)),
    y: Math.max(gap, Math.min(event.clientY, window.innerHeight - menuHeight - gap)),
  };
}

function openNodeContextMenu(node: FileNode, event: MouseEvent) {
  contextMenu.value = { ...contextMenuPosition(event), node };
}

function openRootContextMenu(event: MouseEvent) {
  contextMenu.value = { ...contextMenuPosition(event), node: null };
}

function closeContextMenu() {
  contextMenu.value = null;
}

function contextTargetDir(): string | null {
  const node = contextMenu.value?.node;
  if (!node) return ws.rootPath;
  return node.isDir ? node.path : dirname(node.path);
}

async function contextOpenFile() {
  const node = contextMenu.value?.node;
  closeContextMenu();
  if (node && !node.isDir) await openFile(node.path);
}

async function contextNewFile() {
  const dir = contextTargetDir();
  closeContextMenu();
  await createWorkspaceFile(dir);
}

async function contextNewFolder() {
  const dir = contextTargetDir();
  closeContextMenu();
  await createWorkspaceFolder(dir);
}

async function contextRename() {
  const node = contextMenu.value?.node;
  closeContextMenu();
  if (node) await renameWorkspaceNode(node);
}

async function contextMove() {
  const node = contextMenu.value?.node;
  closeContextMenu();
  if (node) await moveWorkspaceNode(node);
}

async function contextMoveToTrash() {
  const node = contextMenu.value?.node;
  closeContextMenu();
  if (node) await deleteWorkspaceNode(node);
}

async function contextRefresh() {
  const dir = contextTargetDir();
  closeContextMenu();
  if (dir) await ws.refreshDir(dir);
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
    await switchTo(neighbor ? neighbor.id : null);
  } else {
    persistSessionSoon();
  }
}

// 防抖自动保存（仅对已命名文档）
function dirtyDocs() {
  return session.docs.filter((d) => d.dirty);
}

async function handleWindowCloseRequested(event: CloseRequestedEvent) {
  if (forceWindowClose) return;
  snapshotEditorDoc(session.activeId);
  const docs = dirtyDocs();
  if (!docs.length) return;

  event.preventDefault();
  const ok = await ask(`还有 ${docs.length} 个未保存文档，确认退出并丢弃这些修改？`, {
    title: "Mira",
    kind: "warning",
  });
  if (!ok) {
    status.value = "已取消关闭，未保存修改仍保留";
    return;
  }

  forceWindowClose = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  persistSessionSoon();

  try {
    await getCurrentWindow().destroy();
  } catch (err) {
    forceWindowClose = false;
    status.value = `关闭窗口失败：${err}`;
  }
}


let timer: ReturnType<typeof setTimeout> | null = null;
let unlistenFs: UnlistenFn | null = null;
let unlistenMoved: UnlistenFn | null = null;
let unlistenWindowClose: UnlistenFn | null = null;
let forceWindowClose = false;
function scheduleAutosave() {
  const doc = session.activeDoc;
  if (!doc || !doc.filePath) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const md = doc === session.activeDoc ? getMarkdown() : doc.rawMd;
      await invoke("write_text_file", { path: doc.filePath!, content: md });
      doc.rawMd = md;
      doc.dirty = false;
      if (doc === session.activeDoc) status.value = `已自动保存 ${doc.filePath}`;
    } catch (e) {
      status.value = `自动保存失败：${e}`;
    }
  }, 1000);
}

watch([filePath, dirty], () => {
  const name = filePath.value ? basename(filePath.value) : activeDoc.value ? "未命名" : "Mira";
  document.title = dirty.value ? `Mira — ${name} •` : `Mira — ${name}`;
});

const fsTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const pendingMoveWindowMs = 1500;
type PendingFsMovePath = { path: string; timer: ReturnType<typeof setTimeout> };
const pendingExternalCreates: PendingFsMovePath[] = [];
const pendingExternalDeletes: PendingFsMovePath[] = [];

function pendingMoveKey(path: string) {
  return basename(path).toLowerCase();
}

function hasOpenDocAtOrUnder(path: string) {
  return session.docs.some((d) => d.filePath && isSameOrChildPath(d.filePath, path));
}

function takePendingMovePath(list: PendingFsMovePath[], path: string): PendingFsMovePath | null {
  const key = pendingMoveKey(path);
  const idx = list.findIndex((item) => pendingMoveKey(item.path) === key);
  if (idx < 0) return null;
  const [item] = list.splice(idx, 1);
  clearTimeout(item.timer);
  return item;
}

function removePendingMovePath(list: PendingFsMovePath[], path: string) {
  const np = normPath(path);
  for (let i = list.length - 1; i >= 0; i--) {
    if (normPath(list[i].path) === np) {
      clearTimeout(list[i].timer);
      list.splice(i, 1);
    }
  }
}

function clearPendingMovePaths(oldPath: string, newPath: string) {
  removePendingMovePath(pendingExternalCreates, oldPath);
  removePendingMovePath(pendingExternalCreates, newPath);
  removePendingMovePath(pendingExternalDeletes, oldPath);
  removePendingMovePath(pendingExternalDeletes, newPath);
}

async function handleMaybeExternalMove(path: string, kind: string): Promise<boolean> {
  if (kind === "create") {
    const deleted = takePendingMovePath(pendingExternalDeletes, path);
    if (deleted) {
      await handleFsMoved(deleted.path, path);
      return true;
    }
    const item: PendingFsMovePath = {
      path,
      timer: setTimeout(() => removePendingMovePath(pendingExternalCreates, path), pendingMoveWindowMs),
    };
    pendingExternalCreates.push(item);
    return false;
  }

  if (kind === "delete" && hasOpenDocAtOrUnder(path)) {
    const created = takePendingMovePath(pendingExternalCreates, path);
    if (created) {
      await handleFsMoved(path, created.path);
      return true;
    }
    const item: PendingFsMovePath = {
      path,
      timer: setTimeout(() => {
        removePendingMovePath(pendingExternalDeletes, path);
        void handleFsChanged(path);
      }, pendingMoveWindowMs),
    };
    pendingExternalDeletes.push(item);
    return true;
  }

  return false;
}

function clearAllPendingMovePaths() {
  for (const item of [...pendingExternalCreates, ...pendingExternalDeletes]) clearTimeout(item.timer);
  pendingExternalCreates.length = 0;
  pendingExternalDeletes.length = 0;
}

const askingDocs = new Set<string>();

async function dedupeOpenDocsForPaths(paths: string[]): Promise<boolean> {
  let changed = false;
  const activeBefore = session.activeId;
  const seen = new Set(paths.map((p) => normPath(p)));
  for (const target of seen) {
    const duplicates = session.docs.filter((d) => d.filePath && normPath(d.filePath) === target);
    if (duplicates.length <= 1) continue;

    // Prefer a dirty duplicate over a clean active tab so external/internal moves never drop unsaved edits.
    const activeDuplicate = duplicates.find((d) => d.id === activeBefore);
    const dirtyDuplicate = activeDuplicate?.dirty ? activeDuplicate : duplicates.find((d) => d.dirty);
    const keeper = dirtyDuplicate ?? activeDuplicate ?? duplicates[0];
    if (keeper.id === activeBefore && keeper.dirty) snapshotEditorDoc(keeper.id);
    let nextMd = keeper.rawMd;
    const nextDirty = duplicates.some((d) => d.dirty);

    if (!nextDirty && keeper.filePath) {
      try {
        nextMd = await invoke<string>("read_text_file", { path: keeper.filePath });
      } catch {
        // Keep the in-memory snapshot if the moved file cannot be read yet.
      }
    }

    keeper.rawMd = nextMd;
    keeper.dirty = nextDirty;
    for (const doc of duplicates) {
      if (doc.id !== keeper.id) {
        session.removeDoc(doc.id);
        changed = true;
      }
    }

    if (duplicates.some((d) => d.id === activeBefore)) {
      session.setActive(keeper.id);
      syncEditorDocDir(keeper.filePath);
      loadIntoEditor(keeper.rawMd || "");
    }
  }
  return changed;
}

async function handleFsMoved(oldPath: string, newPath: string) {
  clearPendingMovePaths(oldPath, newPath);
  await ws.syncExternalMove(oldPath, newPath);

  const affectedDocs = session.docs.filter((d) => d.filePath && isSameOrChildPath(d.filePath, oldPath));
  const changedPaths: string[] = [];
  for (const doc of affectedDocs) {
    const nextPath = replacePathPrefix(doc.filePath!, oldPath, newPath);
    doc.filePath = nextPath;
    changedPaths.push(nextPath);
    if (session.activeId === doc.id) syncEditorDocDir(doc.filePath);
  }

  const deduped = await dedupeOpenDocsForPaths(changedPaths.length ? changedPaths : [newPath]);
  if (affectedDocs.length || deduped) persistSessionSoon();

  recent.renameRecent(oldPath, newPath);
  status.value = `External move synced: ${basename(oldPath)} -> ${basename(newPath)}`;
}

async function handleFsChanged(path: string) {
  const np = normPath(path);
  const doc = session.docs.find((d) => d.filePath && normPath(d.filePath) === np);
  if (!doc) return; // 不在任何已打开 tab 中，忽略
  if (doc === session.activeDoc) {
    if (!doc.dirty) {
      // 无未保存修改：静默重载
      try {
        const text = await invoke<string>("read_text_file", { path });
        doc.rawMd = text;
        loadIntoEditor(text);
        status.value = "文件已被外部修改，已重新加载";
      } catch (err) {
        status.value = `重载失败：${err}`;
      }
    } else {
      // 有未保存修改：提示（per-doc 锁，避免 notify 突发事件弹多次）
      if (askingDocs.has(doc.id)) return;
      askingDocs.add(doc.id);
      try {
        const ok = await ask(`文件 ${basename(path)} 已被外部修改，是否重新加载？（丢弃当前未保存修改）`, {
          title: "Mira",
          kind: "warning",
        });
        if (ok) {
          try {
            const text = await invoke<string>("read_text_file", { path });
            doc.rawMd = text;
            loadIntoEditor(text);
            doc.dirty = false;
            status.value = `已重新加载 ${path}`;
          } catch (err) {
            status.value = `重载失败：${err}`;
          }
        } else {
          status.value = "已保留本地修改（外部改动未加载）";
        }
      } finally {
        askingDocs.delete(doc.id);
      }
    }
  } else {
    // 后台 tab：若无未保存修改，刷新其 rawMd（下次切入用新内容）
    if (!doc.dirty) {
      try {
        doc.rawMd = await invoke<string>("read_text_file", { path });
      } catch {
        /* ignore */
      }
    }
  }
}

function onImageInserted(e: Event) {
  const rel = (e as CustomEvent<{ src?: string }>).detail?.src;
  status.value = rel ? `图片已插入 ${rel}` : "图片已插入";
}

function onImageError(e: Event) {
  const message = (e as CustomEvent<{ message?: string }>).detail?.message;
  status.value = message || "图片插入失败";
}

async function restoreLastSession() {
  const savedRoot = ws.savedRoot();
  if (savedRoot) {
    try {
      await ws.setRoot(savedRoot);
    } catch (e) {
      ws.clearSavedRoot();
      status.value = `恢复工作区失败：${e}`;
    }
  }

  const snap = session.loadSnapshot();
  if (!snap.openPaths.length) return;
  restoringSession = true;
  let restored = 0;
  try {
    for (const p of snap.openPaths) {
      await openFile(p);
      if (session.findDocByPath(p)) restored++;
    }
    if (snap.activePath) {
      const active = session.findDocByPath(snap.activePath);
      if (active) await switchTo(active.id);
    }
  } finally {
    restoringSession = false;
    session.persistSession();
  }
  status.value = restored === snap.openPaths.length
    ? `已恢复 ${restored} 个文件`
    : `已恢复 ${restored}/${snap.openPaths.length} 个文件`;
}

onMounted(async () => {
  window.addEventListener("mira:image-inserted", onImageInserted as EventListener);
  window.addEventListener("mira:image-error", onImageError as EventListener);
  window.addEventListener("click", closeContextMenu);
  unlistenWindowClose = await getCurrentWindow().onCloseRequested(handleWindowCloseRequested);
  // 文件监听：外部改动当前/已打开的文档时重载或提示（设计 §9.4 / §16.5）
  unlistenFs = await listen<{ path: string; kind: string }>("fs:changed", (e) => {
    const { path, kind } = e.payload;
    // 按路径去抖 300ms，合并 notify 对一次保存触发的多次事件
    if (fsTimers[path]) clearTimeout(fsTimers[path]);
    fsTimers[path] = setTimeout(async () => {
      delete fsTimers[path];
      // 文件树只需要结构变化；普通 modify 只交给已打开文档的重载逻辑，避免事件风暴卡顿。
      if (kind === "create" || kind === "delete") {
        try { await ws.refreshForPath(path); } catch { /* ignore */ }
        if (await handleMaybeExternalMove(path, kind)) return;
      }
      handleFsChanged(path);
    }, 300);
  });
  unlistenMoved = await listen<{ oldPath: string; newPath: string }>("fs:moved", async (e) => {
    const { oldPath, newPath } = e.payload;
    try {
      await handleFsMoved(oldPath, newPath);
    } catch (err) {
      status.value = `Failed to sync external move: ${err}`;
    }
  });
  await restoreLastSession();
});

onBeforeUnmount(() => {
  snapshotEditorDoc(session.activeId);
  saveDocScroll(session.activeId);
  window.removeEventListener("mira:image-inserted", onImageInserted as EventListener);
  window.removeEventListener("mira:image-error", onImageError as EventListener);
  window.removeEventListener("click", closeContextMenu);
  if (timer) clearTimeout(timer);
  clearAllPendingMovePaths();
  if (unlistenFs) unlistenFs();
  if (unlistenMoved) unlistenMoved();
  if (unlistenWindowClose) unlistenWindowClose();
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
    <Tabs v-if="session.docs.length" @close="closeDoc" @switch="switchTo" />
    <div class="body">
      <aside class="sidebar">
        <section class="sidebar-section" v-if="recent.recentPaths.length">
          <div class="sidebar-header">最近打开</div>
          <div
            v-for="p in recent.recentPaths"
            :key="p"
            class="tree-row recent-row"
            :title="p"
            @click="openFile(p)"
          >
            <span class="chevron">·</span>
            <span class="name">{{ basename(p) }}</span>
          </div>
        </section>
        <section v-if="ws.rootPath">
          <div
            class="sidebar-header workspace-header"
            :title="ws.rootPath"
            @contextmenu.prevent="openRootContextMenu($event)"
          >
            <span class="workspace-name">{{ ws.rootName }}</span>
            <span class="workspace-hint">右键操作</span>
          </div>
          <div class="tree" @contextmenu.self.prevent="openRootContextMenu($event)">
            <FileTreeNode
              v-for="child in ws.childrenOf(ws.rootPath) || []"
              :key="child.path"
              :node="child"
              :depth="0"
              @open-file="openFile"
              @context-menu="openNodeContextMenu"
            />
            <div v-if="ws.childrenOf(ws.rootPath) === null" class="tree-loading">加载中…</div>
          </div>
        </section>
        <div v-if="!ws.rootPath && !recent.recentPaths.length" class="empty-hint">
          打开一个文件夹或文件开始
        </div>
      </aside>
      <EditorContent v-if="editor" :editor="editor" class="mira-editor editor" />
    </div>
    <div
      v-if="contextMenu"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
      @contextmenu.prevent
    >
      <button v-if="contextMenu.node && !contextMenu.node.isDir" @click="contextOpenFile">打开</button>
      <button v-if="!contextMenu.node || contextMenu.node.isDir" @click="contextNewFile">新建文件</button>
      <button v-if="!contextMenu.node || contextMenu.node.isDir" @click="contextNewFolder">新建文件夹</button>
      <div v-if="contextMenu.node" class="context-separator"></div>
      <button v-if="contextMenu.node" @click="contextRename">重命名</button>
      <button v-if="contextMenu.node" @click="contextMove">移动到...</button>
      <button v-if="contextMenu.node" class="danger" @click="contextMoveToTrash">移到回收站</button>
      <div class="context-separator"></div>
      <button @click="contextRefresh">刷新</button>
    </div>
    <footer class="status">{{ status }}</footer>
  </div>
</template>
