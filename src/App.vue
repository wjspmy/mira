<script setup lang="ts">
import { ref, watch, onBeforeUnmount, onMounted, computed, nextTick, shallowRef, triggerRef } from "vue";
import { Editor, EditorContent } from "@tiptap/vue-3";
import type { Editor as CoreEditor } from "@tiptap/core";
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
import { useSessionStore, type Doc } from "./stores/session";
import { useRecentStore } from "./stores/recent";
import { useShortcutsStore } from "./stores/shortcuts";
import { useEditorModeStore } from "./stores/editor-mode";
import { useSettingsStore } from "./stores/settings";
import { SHORTCUT_COMMANDS, type ShortcutCommandId } from "./shortcuts/registry";
import { displayShortcut, shortcutFromEvent } from "./shortcuts/keyboard";
import type { AppMenuCommandId } from "./menus/appMenu";
import FileTreeNode from "./components/FileTree.vue";
import Tabs from "./components/Tabs.vue";
import ShortcutSettings from "./components/ShortcutSettings.vue";
import CommandPalette from "./components/CommandPalette.vue";
import SourceEditor from "./components/SourceEditor.vue";
import OutlinePanel from "./components/OutlinePanel.vue";
import FindReplace from "./components/FindReplace.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import AppMenuBar from "./components/AppMenuBar.vue";
import { GithubAlertBlockquote } from "./editor/github-alert";
import { buildAlertBlockquote, type EditorToolbarAction, type GithubAlertType } from "./editor/toolbar";
import { extractOutline, type OutlineItem } from "./editor/outline";
import { countDocumentStats, formatStatsLabel } from "./editor/stats";
import { findMatches, nextMatchIndex, replaceAllMatches } from "./editor/find-replace";
import { collectSourceMatches, collectVisualMatches, revealVisualMatch } from "./editor/find-in-editor";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog, ask, message as messageDialog } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow, type CloseRequestedEvent } from "@tauri-apps/api/window";
import { basename, dirname, isSameOrChildPath, normPath, normalizeNativePath, replacePathPrefix } from "./utils/path";
import { clearCustomCss, upsertCustomCss } from "./editor/custom-css";
import { formatDocSizeLabel, isLargeDocument } from "./editor/large-doc";
import { visualSelectionToMarkdownOffset } from "./editor/mode-bridge";
import { markdownToHtmlFragment, printHtmlDocument, wrapStandaloneHtml, wrapWordDocument, base64ToBytes } from "./services/export";
import { inlineImagesInHtml } from "./services/export-images";
import { sanitizeExportFileName, withExtension } from "./services/export-name";
import { toPng } from "html-to-image";

const ws = useWorkspaceStore();
const session = useSessionStore();
const recent = useRecentStore();
const shortcuts = useShortcutsStore();
const editorMode = useEditorModeStore();
const settings = useSettingsStore();
const status = ref("就绪");
const showShortcutSettings = ref(false);
const showCommandPalette = ref(false);
const showOutline = ref(localStorage.getItem("mira-outline") === "1");
const showFindReplace = ref(false);
const findShowReplaceRow = ref(false);
const findQuery = ref("");
const findReplacement = ref("");
const findUseRegex = ref(false);
const findCaseSensitive = ref(false);
const findIndex = ref(-1);
const sourceEditorRef = ref<InstanceType<typeof SourceEditor> | null>(null);
const paletteWorkspacePaths = ref<string[]>([]);
const paletteLoading = ref(false);
const paletteError = ref("");
let paletteIndexRequest = 0;
let paletteIndexTimer: number | null = null;
let paletteIndexedRoot: string | null = null;
let restoringSession = false;
let customCssLoadRequest = 0;


async function applyCustomCssFromSettings() {
  const requestId = ++customCssLoadRequest;
  const path = settings.customCssPath;
  clearCustomCss();
  if (!path) return;
  try {
    await invoke("allow_path", { path });
    const css = await invoke<string>("read_text_file", { path });
    if (requestId !== customCssLoadRequest || settings.customCssPath !== path) return;
    upsertCustomCss(css);
    status.value = `已加载自定义 CSS ${path}`;
  } catch (error) {
    if (requestId !== customCssLoadRequest) return;
    clearCustomCss();
    status.value = `自定义 CSS 加载失败：${error}`;
  }
}

watch(() => [settings.customCssPath, settings.customCssVersion], () => {
  void applyCustomCssFromSettings();
});

// 监听自定义 CSS 所在目录，外部改动文件后自动热加载（设计 §19.3）。
watch(() => settings.customCssPath, async (path) => {
  if (!path) return;
  try {
    await invoke("allow_path", { path });
    const dir = dirname(path);
    if (dir) await invoke("watch", { root: dir });
  } catch {
    /* 监听失败不阻断编辑；仍可在设置里手动重新加载 */
  }
});

const DRAFTS_KEY = "mira-drafts";
type DraftSnapshot = {
  id: string;
  filePath: string | null;
  rawMd: string;
  dirty: boolean;
  scrollTop?: number;
  savedAt: number;
};

function draftKeyForDoc(doc: Pick<Doc, "id" | "filePath">): string {
  return doc.filePath ? "file:" + normPath(doc.filePath) : "untitled:" + doc.id;
}

function loadDraftMap(): Record<string, DraftSnapshot> {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const drafts: Record<string, DraftSnapshot> = {};
    for (const [key, value] of Object.entries(raw)) {
      const draft = value as Partial<DraftSnapshot>;
      if (typeof draft.id !== "string" || typeof draft.rawMd !== "string") continue;
      drafts[key] = {
        id: draft.id,
        filePath: typeof draft.filePath === "string" ? normalizeNativePath(draft.filePath) : null,
        rawMd: draft.rawMd,
        dirty: draft.dirty !== false,
        scrollTop: typeof draft.scrollTop === "number" ? draft.scrollTop : undefined,
        savedAt: typeof draft.savedAt === "number" ? draft.savedAt : 0,
      };
    }
    return drafts;
  } catch {
    return {};
  }
}

function persistDraftMap(drafts: Record<string, DraftSnapshot>) {
  if (Object.keys(drafts).length) {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } else {
    localStorage.removeItem(DRAFTS_KEY);
  }
}

function removeDraftForDoc(doc: Pick<Doc, "id" | "filePath">) {
  const drafts = loadDraftMap();
  const keys = new Set<string>([draftKeyForDoc(doc), "untitled:" + doc.id]);
  const normalizedPath = doc.filePath ? normPath(doc.filePath) : null;
  for (const [key, draft] of Object.entries(drafts)) {
    if (draft.id === doc.id) keys.add(key);
    if (normalizedPath && draft.filePath && normPath(draft.filePath) === normalizedPath) keys.add(key);
  }
  for (const key of keys) delete drafts[key];
  persistDraftMap(drafts);
}

function currentMarkdownForDoc(doc: Doc): string {
  if (editorMode.mode === "source" && doc.id === session.activeId) return doc.rawMd;
  if (editorMode.mode === "source" && isLargeDocument(doc.rawMd)) return doc.rawMd;
  return markdownFromEditor(editorForDoc(doc.id)) || doc.rawMd;
}

function saveDraftForDoc(doc: Doc) {
  if (doc.filePath && !doc.dirty) {
    removeDraftForDoc(doc);
    return;
  }
  const rawMd = currentMarkdownForDoc(doc);
  if (!rawMd.trim()) {
    removeDraftForDoc(doc);
    return;
  }
  const drafts = loadDraftMap();
  drafts[draftKeyForDoc(doc)] = {
    id: doc.id,
    filePath: doc.filePath ? normalizeNativePath(doc.filePath) : null,
    rawMd,
    dirty: doc.dirty || !doc.filePath,
    scrollTop: doc.scrollTop,
    savedAt: Date.now(),
  };
  persistDraftMap(drafts);
}

function saveRecoverableDrafts() {
  snapshotEditorDoc(session.activeId);
  saveDocScroll(session.activeId);
  for (const doc of session.docs) {
    if (!doc.filePath || doc.dirty) saveDraftForDoc(doc);
    else removeDraftForDoc(doc);
  }
}

function pendingDrafts(): DraftSnapshot[] {
  return Object.values(loadDraftMap()).sort((a, b) => b.savedAt - a.savedAt);
}

type ContextMenuState = {
  x: number;
  y: number;
  node: FileNode | null;
};
const contextMenu = ref<ContextMenuState | null>(null);

// 主题：设置项优先，兼容旧 mira-theme；system 跟随系统
const theme = ref<"light" | "dark">("light");
function applyTheme(t: string) {
  document.documentElement.dataset.theme = t;
}
function syncThemeFromSettings() {
  const systemDark = !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  theme.value = settings.resolveTheme(systemDark);
  applyTheme(theme.value);
}
function toggleTheme() {
  if (settings.theme === "dark") settings.setTheme("light");
  else if (settings.theme === "light") settings.setTheme("dark");
  else settings.setTheme(theme.value === "dark" ? "light" : "dark");
  syncThemeFromSettings();
}
watch(() => settings.theme, syncThemeFromSettings);
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", syncThemeFromSettings);
syncThemeFromSettings();

function focusVisualEditor() {
  // 保持 Tiptap 自身选区，避免模式切换时被强制跳到文末。
  const ed = activeEditor.value as any;
  const chain = ed?.chain?.().focus?.();
  if (chain?.run) chain.run();
}

async function toggleSourceMode() {
  const doc = session.activeDoc;
  if (editorMode.mode === "visual") {
    snapshotEditorDoc();
    if (doc) {
      doc.sourceSelection = visualSelectionToMarkdownOffset(editorForDoc(doc.id)) ?? undefined;
    }
  } else if (doc) {
    sourceEditorRef.value?.flushPendingChange();
    doc.sourceSelection = sourceEditorRef.value?.getSelection() ?? doc.sourceSelection;
    if (isLargeDocument(doc.rawMd)) {
      status.value = "大文档载入所见即所得视图可能较慢…";
      setEditorContent(doc.id, doc.rawMd, false);
    } else {
      const visualMarkdown = markdownFromEditor(editorForDoc(doc.id));
      if (visualMarkdown !== doc.rawMd) {
        // 把源码模式的整次编辑作为一个历史节点同步回 Tiptap，保留此前的撤销栈。
        setEditorContent(doc.id, doc.rawMd, false);
      }
    }
  }
  const next = editorMode.toggleMode();
  await nextTick();
  if (next === "source") sourceEditorRef.value?.focus(session.activeDoc?.sourceSelection);
  else focusVisualEditor();
  status.value = next === "source" ? "已切换到源码模式" : "已切换到所见即所得模式";
}

/** 大文件默认走 CodeMirror 源码模式（虚拟滚动），对标 VS Code / Typora 的降级策略，不弹窗。 */
async function preferSourceModeForLargeDoc(doc: Doc | null) {
  if (!doc || editorMode.mode === "source") return;
  if (!isLargeDocument(doc.rawMd)) return;
  editorMode.setMode("source");
  await nextTick();
  sourceEditorRef.value?.focus();
  status.value = `大文件（${formatDocSizeLabel(doc.rawMd)}）已使用源码模式打开`;
}

function onSourceUpdate(value: string) {
  const doc = session.activeDoc;
  if (!doc || doc.rawMd === value) return;
  doc.rawMd = value;
  doc.dirty = true;
  saveDraftForDoc(doc);
  scheduleAutosave();
}

async function openFolder() {
  const path = await ws.openFolder();
  if (path) status.value = `已打开文件夹 ${path}`;
}

function openSettings() {
  closeContextMenu();
  showShortcutSettings.value = true;
}

function clearPaletteIndexTimer() {
  if (paletteIndexTimer !== null) {
    window.clearTimeout(paletteIndexTimer);
    paletteIndexTimer = null;
  }
}

function closeCommandPalette() {
  showCommandPalette.value = false;
  clearPaletteIndexTimer();
}

async function indexPaletteWorkspace(root: string, requestId: number) {
  paletteLoading.value = true;
  try {
    const paths = await ws.listSearchableFiles();
    if (requestId === paletteIndexRequest && ws.rootPath === root) {
      paletteWorkspacePaths.value = paths;
      paletteIndexedRoot = root;
    }
  } catch (error) {
    if (requestId === paletteIndexRequest) {
      console.error("workspace file index failed", error);
      paletteError.value = "工作区文件索引失败，请稍后重试。";
    }
  } finally {
    if (requestId === paletteIndexRequest) {
      paletteLoading.value = false;
    }
  }
}

function schedulePaletteWorkspaceIndex(query: string) {
  clearPaletteIndexTimer();
  const root = ws.rootPath;
  const needle = query.trim();
  if (!showCommandPalette.value || !root || needle.length < 2 || paletteLoading.value || paletteIndexedRoot === root) return;

  const requestId = ++paletteIndexRequest;
  paletteIndexTimer = window.setTimeout(() => {
    paletteIndexTimer = null;
    void indexPaletteWorkspace(root, requestId);
  }, 280);
}

async function openCommandPalette() {
  closeContextMenu();
  showCommandPalette.value = true;
  paletteError.value = "";

  if (paletteIndexedRoot !== ws.rootPath) {
    paletteWorkspacePaths.value = [];
    paletteIndexedRoot = null;
    paletteLoading.value = false;
    ++paletteIndexRequest;
  }
}

async function runPaletteCommand(commandId: ShortcutCommandId) {
  closeCommandPalette();
  await executeShortcut(commandId);
}

async function openPaletteFile(path: string) {
  closeCommandPalette();
  await openFile(path);
}

function handlePaletteQueryChange(query: string) {
  schedulePaletteWorkspaceIndex(query);
}
watch(theme, (t) => {
  applyTheme(t);
});
applyTheme(theme.value);

watch(
  () => [settings.editorFontSize, settings.editorFontFamily],
  () => {
    const root = document.documentElement;
    root.style.setProperty("--editor-font-size", `${settings.editorFontSize}px`);
    if (settings.editorFontFamily) root.style.setProperty("--font-body", settings.editorFontFamily);
    else root.style.removeProperty("--font-body");
  },
  { immediate: true },
);

const lowlight = createLowlight(common);
const MiraCodeBlockLowlight = CodeBlockLowlight.extend({
  renderHTML({ node, HTMLAttributes }: any) {
    const language = node.attrs.language as string | null;
    return [
      "pre",
      {
        ...this.options.HTMLAttributes,
        ...HTMLAttributes,
        ...(language ? { "data-language": language } : {}),
      },
      [
        "code",
        {
          class: language ? this.options.languageClassPrefix + language : null,
        },
        0,
      ],
    ];
  },
});
const loadingDocIds = new Set<string>(); // Suppress onUpdate during programmatic editor state changes.
const editors = shallowRef(new Map<string, Editor>());

function editorForDoc(id: string | null = session.activeId): Editor | null {
  return id ? editors.value.get(id) ?? null : null;
}

const activeEditor = computed(() => {
  // Depend on the shallow ref so triggerRef(editors) refreshes this when a new editor is created.
  const map = editors.value;
  return session.activeId ? map.get(session.activeId) ?? null : null;
});

function markdownFromEditor(ed: CoreEditor | null | undefined): string {
  const doc = ed?.state.doc;
  return doc ? serializeDocToMarkdown(doc) : "";
}

function getMarkdown(id: string | null = session.activeId): string {
  const doc = id ? session.docs.find((item) => item.id === id) : null;
  if (doc && editorMode.mode === "source" && id === session.activeId) return doc.rawMd;
  // 源码模式下后台/大文件标签未挂载 Tiptap，必须用 rawMd。
  if (doc && editorMode.mode === "source" && isLargeDocument(doc.rawMd)) return doc.rawMd;
  return markdownFromEditor(editorForDoc(id)) || doc?.rawMd || "";
}

function resetEditorHistory(ed: Editor) {
  const cleanState = EditorState.create({
    schema: ed.schema,
    doc: ed.state.doc,
    plugins: ed.state.plugins,
  });
  ed.view.updateState(cleanState);
}

function setEditorContent(id: string, md: string, resetHistory = true) {
  const ed = editorForDoc(id);
  if (!ed) return;
  loadingDocIds.add(id);
  try {
    ed.commands.setContent(md || "");
    if (resetHistory) resetEditorHistory(ed);
  } finally {
    loadingDocIds.delete(id);
  }
}

function createDocEditor(doc: Doc): Editor {
  const ed = new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false, blockquote: false }),
      GithubAlertBlockquote,
      MiraCodeBlockLowlight.configure({ lowlight }),
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
    // 大文件默认走源码模式，此处不解析整篇，避免创建 Tiptap 时卡死。
    content: isLargeDocument(doc.rawMd) ? "" : (doc.rawMd || ""),
    editorProps: {
      handleKeyDown: () => false,
    },
    onUpdate: ({ editor: updatedEditor }) => {
      if (loadingDocIds.has(doc.id)) return;
      doc.rawMd = markdownFromEditor(updatedEditor);
      doc.dirty = true;
      saveDraftForDoc(doc);
      scheduleAutosave();
    },
  });
  ed.storage.miraDocDir = doc.filePath ? dirname(doc.filePath) || undefined : undefined;
  resetEditorHistory(ed);
  return ed;
}

function ensureDocEditor(doc: Doc): Editor {
  let ed = editors.value.get(doc.id);
  if (!ed) {
    ed = createDocEditor(doc);
    editors.value.set(doc.id, ed);
    triggerRef(editors);
  }
  return ed;
}

function destroyDocEditor(id: string) {
  const ed = editors.value.get(id);
  if (ed) ed.destroy();
  if (editors.value.delete(id)) triggerRef(editors);
}

function loadIntoEditor(md: string, docId: string | null = session.activeId) {
  if (!docId) return;
  const doc = session.docs.find((d) => d.id === docId);
  if (!doc) return;
  doc.rawMd = md;
  if (editorMode.mode === "source" && isLargeDocument(md)) return;
  ensureDocEditor(doc);
  setEditorContent(docId, md, true);
  if (!isLargeDocument(md)) doc.rawMd = getMarkdown(docId);
}

function snapshotEditorDoc(id: string | null = session.activeId) {
  if (!id) return;
  const doc = session.docs.find((d) => d.id === id);
  if (!doc) return;
  if (editorMode.mode === "source" && id === session.activeId) return;
  if (editorMode.mode === "source" && isLargeDocument(doc.rawMd)) return;
  const ed = editorForDoc(id);
  if (ed && editorMode.mode === "visual") doc.rawMd = markdownFromEditor(ed);
}

function syncEditorDocDir(path: string | null | undefined, docId: string | null = session.activeId) {
  const ed = editorForDoc(docId);
  if (!ed) return;
  ed.storage.miraDocDir = path ? dirname(path) || undefined : undefined;
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
const hasActiveDoc = computed(() => !!session.activeDoc);
const hasOpenTabs = computed(() => session.docs.length > 0);
const currentPathLabel = computed(() => filePath.value ?? "未命名");
const saveStateLabel = computed(() => dirty.value ? "● 未保存" : "已保存");

const currentMarkdownSnapshot = computed(() => {
  if (!session.activeDoc) return "";
  if (editorMode.mode === "source") return session.activeDoc.rawMd;
  return markdownFromEditor(editorForDoc(session.activeDoc.id)) || session.activeDoc.rawMd;
});

const outlineItems = computed(() => extractOutline(currentMarkdownSnapshot.value));
const docStats = computed(() => countDocumentStats(currentMarkdownSnapshot.value));
const statsLabel = computed(() => formatStatsLabel(docStats.value));

const findMatchList = computed(() =>
  findMatches(currentMarkdownSnapshot.value, findQuery.value, {
    useRegex: findUseRegex.value,
    caseSensitive: findCaseSensitive.value,
  }),
);

/** 传给查找条的匹配数：源码用 Markdown，所见即所得用 PM 文本节点 */
const findMatchCount = computed(() => {
  if (!findQuery.value) return 0;
  if (editorMode.mode === "source") return findMatchList.value.length;
  return currentVisualMatches().length;
});

function toggleOutline() {
  showOutline.value = !showOutline.value;
  localStorage.setItem("mira-outline", showOutline.value ? "1" : "0");
}

function openFind(withReplace = false) {
  if (!session.activeDoc) {
    status.value = "没有可查找的文档";
    return;
  }
  // 若当前有选区，预填查找词（Typora / Notepad++ 习惯）
  if (!findQuery.value) {
    if (editorMode.mode === "source") {
      // 源码模式暂不自动取选区
    } else {
      const ed = activeEditor.value;
      const selected = ed?.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, " ");
      if (selected && selected.length <= 200) findQuery.value = selected;
    }
  }
  findShowReplaceRow.value = withReplace;
  showFindReplace.value = true;
  findIndex.value = -1;
}

function openFindOnly() {
  openFind(false);
}

function openFindAndReplace() {
  openFind(true);
}

function closeFindReplace() {
  showFindReplace.value = false;
}

// 输入查找词时自动跳到第一处（VS Code 行为）
watch(findQuery, () => {
  findIndex.value = -1;
  if (showFindReplace.value && findQuery.value) {
    void nextTick(() => gotoFindMatch(1));
  }
});
watch(findUseRegex, () => {
  findIndex.value = -1;
});
watch(findCaseSensitive, () => {
  findIndex.value = -1;
});

function scrollToMarkdownOffset(item: OutlineItem) {
  if (editorMode.mode === "source") {
    sourceEditorRef.value?.scrollToOffset(item.offset);
    return;
  }
  const ed = editorForDoc(session.activeId);
  if (!ed) return;
  // 在 ProseMirror 文档中按标题文本定位
  let pos: number | null = null;
  ed.state.doc.descendants((node, nodePos) => {
    if (pos !== null) return false;
    if (node.type.name === "heading") {
      const text = node.textContent.trim();
      if (text === item.text) {
        pos = nodePos;
        return false;
      }
    }
    return true;
  });
  if (pos === null) {
    status.value = "未在所见即所得视图中找到该标题";
    return;
  }
  ed.commands.setTextSelection(Math.min(pos + 1, ed.state.doc.content.size));
  ed.commands.focus();
  const dom = ed.view.domAtPos(Math.min(pos + 1, ed.state.doc.content.size)).node;
  const el = dom.nodeType === 1 ? (dom as HTMLElement) : dom.parentElement;
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** 所见即所得：在 PM 文本节点中收集可精确定位的匹配 */
function currentVisualMatches() {
  const ed = editorForDoc(session.activeId);
  if (!ed || !findQuery.value) return [];
  return collectVisualMatches(ed, findQuery.value, {
    useRegex: findUseRegex.value,
    caseSensitive: findCaseSensitive.value,
  });
}

function gotoFindMatch(delta: 1 | -1) {
  if (!findQuery.value) return;
  if (editorMode.mode === "source") {
    const matches = collectSourceMatches(currentMarkdownSnapshot.value, findQuery.value, {
      useRegex: findUseRegex.value,
      caseSensitive: findCaseSensitive.value,
    });
    if (!matches.length) {
      findIndex.value = -1;
      status.value = "无结果";
      return;
    }
    findIndex.value = nextMatchIndex(findIndex.value, matches.length, delta);
    const match = matches[findIndex.value];
    if (match) sourceEditorRef.value?.scrollToOffset(match.index, match.length);
    return;
  }

  const visualMatches = currentVisualMatches();
  if (!visualMatches.length) {
    findIndex.value = -1;
    status.value = "无结果";
    return;
  }
  findIndex.value = nextMatchIndex(findIndex.value, visualMatches.length, delta);
  const match = visualMatches[findIndex.value];
  const ed = editorForDoc(session.activeId);
  if (match && ed) revealVisualMatch(ed, match);
}

function applyReplaceAll() {
  if (!session.activeDoc || !findQuery.value) return;
  const source = currentMarkdownSnapshot.value;
  const result = replaceAllMatches(source, findQuery.value, findReplacement.value, {
    useRegex: findUseRegex.value,
    caseSensitive: findCaseSensitive.value,
  });
  if (!result.count) {
    status.value = "无匹配";
    return;
  }
  session.activeDoc.rawMd = result.text;
  session.activeDoc.dirty = true;
  if (editorMode.mode === "source") {
    // SourceEditor 通过 modelValue 同步
  } else {
    setEditorContent(session.activeDoc.id, result.text, true);
  }
  saveDraftForDoc(session.activeDoc);
  scheduleAutosave();
  findIndex.value = -1;
  status.value = `已替换 ${result.count} 处`;
}

function applyReplaceOne() {
  if (!session.activeDoc || !findQuery.value) return;
  if (editorMode.mode === "visual") {
    const visualMatches = currentVisualMatches();
    if (!visualMatches.length) {
      status.value = "无结果";
      return;
    }
    findIndex.value = nextMatchIndex(findIndex.value, visualMatches.length, 1);
    const match = visualMatches[findIndex.value];
    const ed = editorForDoc(session.activeId);
    if (!match || !ed) return;
    revealVisualMatch(ed, match);
    ed.chain().deleteRange({ from: match.from, to: match.to }).insertContent(findReplacement.value).focus().run();
    session.activeDoc.rawMd = markdownFromEditor(ed);
    session.activeDoc.dirty = true;
    saveDraftForDoc(session.activeDoc);
    scheduleAutosave();
    status.value = `已替换第 ${findIndex.value + 1} 处`;
    return;
  }

  const matches = collectSourceMatches(currentMarkdownSnapshot.value, findQuery.value, {
    useRegex: findUseRegex.value,
    caseSensitive: findCaseSensitive.value,
  });
  if (!matches.length) return;
  findIndex.value = nextMatchIndex(findIndex.value, matches.length, 1);
  const match = matches[findIndex.value];
  if (!match) return;
  sourceEditorRef.value?.scrollToOffset(match.index, match.length);
  const source = currentMarkdownSnapshot.value;
  const next = source.slice(0, match.index) + findReplacement.value + source.slice(match.index + match.length);
  session.activeDoc.rawMd = next;
  session.activeDoc.dirty = true;
  saveDraftForDoc(session.activeDoc);
  scheduleAutosave();
  status.value = `已替换第 ${findIndex.value + 1} 处`;
}

const menuShortcutLabels = computed<Partial<Record<ShortcutCommandId, string>>>(() => {
  const result: Partial<Record<ShortcutCommandId, string>> = {};
  for (const command of SHORTCUT_COMMANDS) {
    result[command.id] = displayShortcut(shortcuts.shortcutFor(command.id));
  }
  return result;
});

function uuid() {
  return (crypto as any).randomUUID?.() ?? String(Date.now()) + Math.random();
}

// 显式切换：先同步保存旧 doc 的 markdown，再 setActive，并显示目标 doc 的独立 Editor 实例。
// 每个 tab 持有独立 rawMd/scrollTop/Editor，避免 undo/redo 跨标签串历史，同时保留本 tab 的撤销栈。
async function switchTo(newId: string | null) {
  const oldId = session.activeId;
  if (newId === oldId) return;
  if (timer) { clearTimeout(timer); timer = null; }
  // 保存 outgoing：序列化为 markdown 字符串（不可变）；已命名 dirty 文档切走前立即落盘，避免防抖保存被取消。
  saveDocScroll(oldId);
  if (oldId && editorForDoc(oldId)) {
    const old = session.docs.find((d) => d.id === oldId);
    if (old) {
      snapshotEditorDoc(oldId);
      if (old.filePath && old.dirty) {
        try {
          await invoke("write_text_file", { path: old.filePath, content: old.rawMd });
          old.dirty = false;
          removeDraftForDoc(old);
          status.value = `已自动保存 ${old.filePath}`;
        } catch (e) {
          status.value = `自动保存失败：${e}`;
        }
      }
    }
  }
  session.setActive(newId);
  // 切换 tab 时不再 setContent/搬运 EditorState；只确保目标文档拥有自己的 Editor 实例。
  if (newId) {
    const next = session.docs.find((d) => d.id === newId);
    if (next) {
      ensureDocEditor(next);
      syncEditorDocDir(next.filePath, next.id);
    }
  }
  await restoreDocScroll(newId);
  persistSessionSoon();
}

function newDoc() {
  const id = uuid();
  session.addDoc({ id, filePath: null, rawMd: "# 新文档\n\n开始写作…", dirty: false });
  switchTo(id);
}

async function saveCurrentFile() {
  if (!session.activeDoc) {
    status.value = "没有可保存的文档";
    return;
  }
  await saveFile();
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
  path = normalizeNativePath(path);
  try {
    await invoke("allow_path", { path });
    const text = await invoke<string>("read_text_file", { path });
    const existing = session.findDocByPath(path);
    if (existing) {
      await switchTo(existing.id);
      await preferSourceModeForLargeDoc(session.activeDoc);
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
    await preferSourceModeForLargeDoc(session.activeDoc);
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
  if (editorMode.mode === "source") sourceEditorRef.value?.flushPendingChange();
  const md = getMarkdown();
  let path = doc.filePath;
  if (!path) {
    path = await saveDialog({
      defaultPath: "untitled.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!path) return;
    path = normalizeNativePath(path);
    doc.filePath = path;
    syncEditorDocDir(path);
    const dir = dirname(path);
    if (dir) {
      try { await invoke("watch", { root: dir }); } catch { /* ignore */ }
    }
  }
  path = normalizeNativePath(path);
  try {
    await invoke("allow_path", { path });
    await invoke("write_text_file", { path, content: md });
    doc.rawMd = md;
    doc.dirty = false;
    removeDraftForDoc(doc);
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
      syncEditorDocDir(doc.filePath, doc.id);
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
  const selectedPath = typeof selected === "string" ? selected : (selected as any).path;
  if (!selectedPath) return;
  const targetDir = normalizeNativePath(selectedPath);
  const oldPath = node.path;
  try {
    const newPath = await ws.moveNodeToDir(node, targetDir);
    const affectedDocs = session.docs.filter((d) => d.filePath && isSameOrChildPath(d.filePath, oldPath));
    const changedPaths: string[] = [];
    for (const doc of affectedDocs) {
      const nextPath = replacePathPrefix(doc.filePath!, oldPath, newPath);
      doc.filePath = nextPath;
      changedPaths.push(nextPath);
      syncEditorDocDir(doc.filePath, doc.id);
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
      removeDraftForDoc(doc);
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
  if (doc && (doc.dirty || !doc.filePath) && !(await ask("该文档有未保存修改，确认关闭？", { title: "Mira", kind: "warning" }))) {
    return;
  }
  const idx = session.docs.findIndex((d) => d.id === id);
  if (idx < 0) return;
  const wasActive = session.activeId === id;
  const neighbor = wasActive ? session.docs[idx + 1] || session.docs[idx - 1] || null : null;
  if (doc) removeDraftForDoc(doc);
  destroyDocEditor(id);
  session.removeDoc(id);
  if (wasActive) {
    await switchTo(neighbor ? neighbor.id : null);
  } else {
    persistSessionSoon();
  }
}

// 防抖自动保存（仅对已命名文档）
function dirtyDocs() {
  return session.docs.filter((d) => d.dirty || !d.filePath);
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
  for (const doc of docs) removeDraftForDoc(doc);
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
      const md = doc === session.activeDoc ? getMarkdown() : currentMarkdownForDoc(doc);
      await invoke("write_text_file", { path: doc.filePath!, content: md });
      doc.rawMd = md;
      doc.dirty = false;
      removeDraftForDoc(doc);
      if (doc === session.activeDoc) status.value = `已自动保存 ${doc.filePath}`;
    } catch (e) {
      status.value = `自动保存失败：${e}`;
    }
  }, settings.autoSaveDelayMs);
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
        destroyDocEditor(doc.id);
        session.removeDoc(doc.id);
        changed = true;
      }
    }

    if (duplicates.some((d) => d.id === activeBefore)) {
      session.setActive(keeper.id);
      syncEditorDocDir(keeper.filePath);
      loadIntoEditor(keeper.rawMd || "", keeper.id);
    }
  }
  return changed;
}

async function handleFsMoved(oldPath: string, newPath: string) {
  oldPath = normalizeNativePath(oldPath);
  newPath = normalizeNativePath(newPath);
  clearPendingMovePaths(oldPath, newPath);
  await ws.syncExternalMove(oldPath, newPath);

  const affectedDocs = session.docs.filter((d) => d.filePath && isSameOrChildPath(d.filePath, oldPath));
  const changedPaths: string[] = [];
  for (const doc of affectedDocs) {
    const nextPath = replacePathPrefix(doc.filePath!, oldPath, newPath);
    doc.filePath = nextPath;
    changedPaths.push(nextPath);
    syncEditorDocDir(doc.filePath, doc.id);
  }

  const deduped = await dedupeOpenDocsForPaths(changedPaths.length ? changedPaths : [newPath]);
  if (affectedDocs.length || deduped) persistSessionSoon();

  recent.renameRecent(oldPath, newPath);
  status.value = `External move synced: ${basename(oldPath)} -> ${basename(newPath)}`;
}

async function handleFsChanged(path: string) {
  path = normalizeNativePath(path);
  const np = normPath(path);
  const doc = session.docs.find((d) => d.filePath && normPath(d.filePath) === np);
  if (!doc) return; // 不在任何已打开 tab 中，忽略
  if (doc === session.activeDoc) {
    if (!doc.dirty) {
      // 无未保存修改：静默重载
      try {
        const text = await invoke<string>("read_text_file", { path });
        doc.rawMd = text;
        loadIntoEditor(text, doc.id);
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
            loadIntoEditor(text, doc.id);
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
        destroyDocEditor(doc.id);
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


async function restoreDrafts() {
  const drafts = pendingDrafts();
  if (!drafts.length) return;

  const draftMap = loadDraftMap();
  let restored = 0;
  for (const draft of drafts) {
    const title = draft.filePath ? basename(draft.filePath) : "未命名文档";
    const savedAt = Number.isFinite(draft.savedAt) ? draft.savedAt : Date.now();
    const ok = await ask("发现未恢复的草稿 \"" + title + "\"（" + new Date(savedAt).toLocaleString() + "），是否恢复？", {
      title: "Mira",
      kind: "warning",
    });

    const normalizedPath = draft.filePath ? normPath(draft.filePath) : null;
    for (const [key, stored] of Object.entries(draftMap)) {
      if (stored.id === draft.id) delete draftMap[key];
      if (normalizedPath && stored.filePath && normPath(stored.filePath) === normalizedPath) delete draftMap[key];
    }

    if (!ok) continue;

    const existing = draft.filePath ? session.findDocByPath(draft.filePath) : null;
    if (existing) {
      existing.rawMd = draft.rawMd;
      existing.dirty = true;
      existing.scrollTop = draft.scrollTop;
      await switchTo(existing.id);
    } else {
      const id = uuid();
      session.addDoc({
        id,
        filePath: draft.filePath,
        rawMd: draft.rawMd,
        dirty: true,
        scrollTop: draft.scrollTop,
      });
      await switchTo(id);
    }
    restored++;
  }

  persistDraftMap(draftMap);
  if (restored) {
    persistSessionSoon();
    status.value = "已恢复 " + restored + " 个草稿";
  }
}


async function closeActiveDoc() {
  if (!session.activeId) {
    status.value = "没有可关闭的标签页";
    return;
  }
  await closeDoc(session.activeId);
}

async function switchTabByOffset(delta: number) {
  if (!session.docs.length) return;
  const current = session.docs.findIndex((doc) => doc.id === session.activeId);
  const from = current >= 0 ? current : 0;
  const next = (from + delta + session.docs.length) % session.docs.length;
  await switchTo(session.docs[next].id);
}

async function switchTabAt(index: number) {
  const doc = session.docs[index];
  if (doc) await switchTo(doc.id);
}

function syncSourceFromVisualHistory(ed: CoreEditor | null | undefined) {
  if (editorMode.mode !== "source" || !session.activeDoc || !ed) return;
  session.activeDoc.rawMd = markdownFromEditor(ed);
  session.activeDoc.dirty = true;
  saveDraftForDoc(session.activeDoc);
  scheduleAutosave();
  void nextTick(() => sourceEditorRef.value?.focus());
}

function runEditorCommand(command: string, options: { focus?: boolean; syncSource?: boolean } = {}) {
  const ed = activeEditor.value as any;
  let chain = ed?.chain?.();
  if (!chain) return false;
  if (options.focus !== false && typeof chain.focus === "function") chain = chain.focus();
  if (typeof chain[command] !== "function") return false;
  const didRun = Boolean(chain[command]().run());
  if (didRun && options.syncSource) syncSourceFromVisualHistory(ed);
  return didRun;
}

function undoVisualEditorHistory() {
  return runEditorCommand("undo", { focus: false, syncSource: true });
}

function redoVisualEditorHistory() {
  return runEditorCommand("redo", { focus: false, syncSource: true });
}

function undoEditorSafely() {
  if (editorMode.mode === "source" && sourceEditorRef.value?.undo()) return;
  undoVisualEditorHistory();
}

function redoEditorSafely() {
  if (editorMode.mode === "source" && sourceEditorRef.value?.redo()) return;
  redoVisualEditorHistory();
}

function insertLink() {
  const ed = activeEditor.value as any;
  if (!ed) return;
  const current = ed.getAttributes?.("link")?.href ?? "";
  const href = window.prompt("链接 URL（留空移除链接）", current);
  if (href === null) return;
  const chain = ed.chain().focus().extendMarkRange("link");
  if (href.trim()) chain.setLink({ href: href.trim() }).run();
  else chain.unsetLink().run();
}

function insertGithubAlert(type: GithubAlertType) {
  const ed = activeEditor.value as any;
  if (!ed) return;
  const md = buildAlertBlockquote(type);
  ed.chain().focus().insertContent(md).run();
}

function handleToolbarAction(action: EditorToolbarAction) {
  const ed = activeEditor.value as any;
  switch (action) {
    case "heading1":
      ed?.chain().focus().toggleHeading({ level: 1 }).run();
      break;
    case "heading2":
      ed?.chain().focus().toggleHeading({ level: 2 }).run();
      break;
    case "heading3":
      ed?.chain().focus().toggleHeading({ level: 3 }).run();
      break;
    case "bold":
      runEditorCommand("toggleBold");
      break;
    case "italic":
      runEditorCommand("toggleItalic");
      break;
    case "strike":
      runEditorCommand("toggleStrike");
      break;
    case "code":
      runEditorCommand("toggleCode");
      break;
    case "link":
      insertLink();
      break;
    case "bulletList":
      runEditorCommand("toggleBulletList");
      break;
    case "orderedList":
      runEditorCommand("toggleOrderedList");
      break;
    case "taskList":
      ed?.chain().focus().toggleTaskList().run();
      break;
    case "blockquote":
      runEditorCommand("toggleBlockquote");
      break;
    case "codeBlock":
      runEditorCommand("toggleCodeBlock");
      break;
    case "hr":
      ed?.chain().focus().setHorizontalRule().run();
      break;
    case "insertTable":
      ed?.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
      break;
    case "alertNote":
      insertGithubAlert("NOTE");
      break;
    case "alertWarning":
      insertGithubAlert("WARNING");
      break;
    case "alertTip":
      insertGithubAlert("TIP");
      break;
  }
  if (editorMode.mode === "visual" && session.activeDoc) {
    const live = editorForDoc(session.activeDoc.id);
    if (live) {
      session.activeDoc.rawMd = markdownFromEditor(live);
      session.activeDoc.dirty = true;
      saveDraftForDoc(session.activeDoc);
      scheduleAutosave();
    }
  }
}

function currentExportMarkdown(): string {
  if (editorMode.mode === "source") {
    sourceEditorRef.value?.flushPendingChange();
    return session.activeDoc?.rawMd || "";
  }
  return getMarkdown();
}

function currentExportTitle(): string {
  const doc = session.activeDoc;
  if (!doc) return "untitled";
  return doc.filePath ? basename(doc.filePath).replace(/\.md$/i, "") : "untitled";
}

async function prepareExportFragment(): Promise<{ fragment: string; title: string; docDir: string | null } | null> {
  const doc = session.activeDoc;
  if (!doc) {
    status.value = "没有可导出的文档";
    return null;
  }
  status.value = "正在准备导出…";
  const md = currentExportMarkdown();
  const title = currentExportTitle();
  const docDir = doc.filePath ? dirname(doc.filePath) : null;
  let fragment = markdownToHtmlFragment(md);
  fragment = await inlineImagesInHtml(fragment, docDir);
  return { fragment, title, docDir };
}

async function pickExportPath(defaultName: string, filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  const target = await saveDialog({ defaultPath: defaultName, filters });
  if (!target) {
    status.value = "已取消导出";
    return null;
  }
  return normalizeNativePath(typeof target === "string" ? target : (target as any).path);
}

async function exportHtml() {
  try {
    const prepared = await prepareExportFragment();
    if (!prepared) return;
    const html = wrapStandaloneHtml(prepared.fragment, { title: prepared.title, theme: theme.value });
    const path = await pickExportPath(withExtension(sanitizeExportFileName(prepared.title), ".html"), [
      { name: "HTML", extensions: ["html", "htm"] },
    ]);
    if (!path) return;
    await invoke("allow_path", { path });
    await invoke("write_text_file", { path, content: html });
    status.value = `已导出 HTML ${path}`;
  } catch (e) {
    status.value = `导出 HTML 失败：${e}`;
  }
}

async function exportPdf() {
  try {
    const prepared = await prepareExportFragment();
    if (!prepared) return;
    const html = wrapStandaloneHtml(prepared.fragment, { title: prepared.title, theme: theme.value });
    if (printHtmlDocument(html)) status.value = "已打开打印对话框（可另存为 PDF）";
    else status.value = "打印导出失败";
  } catch (e) {
    status.value = `导出 PDF 失败：${e}`;
  }
}

async function exportDoc() {
  try {
    const prepared = await prepareExportFragment();
    if (!prepared) return;
    const html = wrapWordDocument(prepared.fragment, { title: prepared.title });
    const path = await pickExportPath(withExtension(sanitizeExportFileName(prepared.title), ".doc"), [
      { name: "Word", extensions: ["doc"] },
    ]);
    if (!path) return;
    await invoke("allow_path", { path });
    await invoke("write_text_file", { path, content: html });
    status.value = `已导出 Word ${path}`;
  } catch (e) {
    status.value = `导出 Word 失败：${e}`;
  }
}

async function exportPng() {
  try {
    const prepared = await prepareExportFragment();
    if (!prepared) return;
    const html = wrapStandaloneHtml(prepared.fragment, { title: prepared.title, theme: "light" });
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:820px;background:#fff;color:#1f2328;padding:32px;";
    host.innerHTML = html.match(/<article[\s\S]*<\/article>/)?.[0] || prepared.fragment;
    document.body.appendChild(host);
    const dataUrl = await toPng(host, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
    host.remove();
    const path = await pickExportPath(withExtension(sanitizeExportFileName(prepared.title), ".png"), [
      { name: "PNG", extensions: ["png"] },
    ]);
    if (!path) return;
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    await invoke("allow_path", { path });
    await invoke("write_file_bytes", { path, bytes: Array.from(base64ToBytes(base64)) });
    status.value = `已导出 PNG ${path}`;
  } catch (e) {
    status.value = `导出 PNG 失败：${e}`;
  }
}

async function executeShortcut(commandId: ShortcutCommandId) {
  const tabIndex = commandId.match(/^tab([1-9])$/)?.[1];
  if (tabIndex) {
    await switchTabAt(Number(tabIndex) - 1);
    return;
  }

  const handlers: Partial<Record<ShortcutCommandId, () => void | Promise<void>>> = {
    newDoc,
    openFile: () => openFile(),
    openFolder,
    saveFile: saveCurrentFile,
    exportHtml,
    exportPdf,
    exportDoc,
    exportPng,
    closeTab: closeActiveDoc,
    nextTab: () => switchTabByOffset(1),
    prevTab: () => switchTabByOffset(-1),
    toggleBold: () => { runEditorCommand("toggleBold"); },
    toggleItalic: () => { runEditorCommand("toggleItalic"); },
    toggleInlineCode: () => { runEditorCommand("toggleCode"); },
    insertLink,
    toggleBulletList: () => { runEditorCommand("toggleBulletList"); },
    toggleOrderedList: () => { runEditorCommand("toggleOrderedList"); },
    toggleBlockquote: () => { runEditorCommand("toggleBlockquote"); },
    toggleCodeBlock: () => { runEditorCommand("toggleCodeBlock"); },
    toggleTheme,
    toggleSourceMode,
    openSettings,
    openCommandPalette,
    findInDocument: openFindOnly,
    replaceInDocument: openFindAndReplace,
    toggleOutline,
  };

  await handlers[commandId]?.();
}

async function executeMenuCommand(commandId: AppMenuCommandId) {
  closeContextMenu();
  if (commandId === "undo") {
    undoEditorSafely();
    return;
  }
  if (commandId === "redo") {
    redoEditorSafely();
    return;
  }
  if (commandId === "aboutMira") {
    await messageDialog("Mira：本地优先的所见即所得 Markdown 编辑器。", { title: "关于 Mira", kind: "info" });
    return;
  }
  await executeShortcut(commandId);
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (showShortcutSettings.value) {
    if (event.key === "Escape") showShortcutSettings.value = false;
    return;
  }
  if (showFindReplace.value && event.key === "Escape") {
    // FindReplace 内部也处理 Esc，这里避免抢走输入框焦点前的全局关闭
  }
  if (showCommandPalette.value) {
    if (event.key === "Escape") closeCommandPalette();
    return;
  }
  const shortcut = shortcutFromEvent(event);
  const commandId = shortcuts.commandForShortcut(shortcut);
  if (!commandId) return;
  event.preventDefault();
  event.stopPropagation();
  void executeShortcut(commandId);
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
  await preferSourceModeForLargeDoc(session.activeDoc);
}

onMounted(async () => {
  void applyCustomCssFromSettings();
  window.addEventListener("mira:image-inserted", onImageInserted as EventListener);
  window.addEventListener("mira:image-error", onImageError as EventListener);
  window.addEventListener("click", closeContextMenu);
  window.addEventListener("keydown", handleGlobalKeydown, true);
  unlistenWindowClose = await getCurrentWindow().onCloseRequested(handleWindowCloseRequested);
  // 文件监听：外部改动当前/已打开的文档时重载或提示（设计 §9.4 / §16.5）
  unlistenFs = await listen<{ path: string; kind: string }>("fs:changed", (e) => {
    const { path, kind } = e.payload;
    // 按路径去抖 300ms，合并 notify 对一次保存触发的多次事件
    if (fsTimers[path]) clearTimeout(fsTimers[path]);
    fsTimers[path] = setTimeout(async () => {
      delete fsTimers[path];
      const cssPath = settings.customCssPath;
      if (cssPath && normPath(normalizeNativePath(path)) === normPath(cssPath)) {
        settings.reloadCustomCss();
        return;
      }
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
  await restoreDrafts();
});

onBeforeUnmount(() => {
  if (!forceWindowClose) saveRecoverableDrafts();
  snapshotEditorDoc(session.activeId);
  saveDocScroll(session.activeId);
  window.removeEventListener("mira:image-inserted", onImageInserted as EventListener);
  window.removeEventListener("mira:image-error", onImageError as EventListener);
  window.removeEventListener("click", closeContextMenu);
  window.removeEventListener("keydown", handleGlobalKeydown, true);
  if (timer) clearTimeout(timer);
  clearAllPendingMovePaths();
  clearPaletteIndexTimer();
  if (unlistenFs) unlistenFs();
  if (unlistenMoved) unlistenMoved();
  if (unlistenWindowClose) unlistenWindowClose();
  clearCustomCss();
  for (const ed of editors.value.values()) ed.destroy();
  editors.value.clear();
  triggerRef(editors);
});
</script>

<template>
  <div class="app">
    <AppMenuBar
      :recent-paths="recent.recentPaths"
      :shortcuts="menuShortcutLabels"
      :has-active-doc="hasActiveDoc"
      :has-open-tabs="hasOpenTabs"
      :editor-mode="editorMode.mode"
      @run-command="executeMenuCommand"
      @open-recent="openFile"
    />
    <Tabs v-if="session.docs.length" @close="closeDoc" @switch="switchTo" />
    <EditorToolbar
      v-if="activeDoc"
      :disabled="!hasActiveDoc"
      :mode="editorMode.mode"
      @action="handleToolbarAction"
    />
    <div class="body">
      <aside class="sidebar">
        <section v-if="ws.rootPath">
          <div
            class="sidebar-header workspace-header"
            :title="ws.rootPath"
            @contextmenu.prevent="openRootContextMenu($event)"
          >
            <span class="workspace-name">{{ ws.rootName }}</span>
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
        <div v-if="!ws.rootPath" class="empty-hint">
          通过“文件”菜单打开文件夹或文件开始
        </div>
      </aside>
      <div class="editor-column">
        <FindReplace
          v-if="showFindReplace && activeDoc"
          :match-count="findMatchCount"
          :current-index="findIndex"
          :mode="editorMode.mode"
          :show-replace="findShowReplaceRow"
          @update:query="(v) => (findQuery = v)"
          @update:replacement="(v) => (findReplacement = v)"
          @update:use-regex="(v) => (findUseRegex = v)"
          @update:case-sensitive="(v) => (findCaseSensitive = v)"
          @find-next="gotoFindMatch(1)"
          @find-prev="gotoFindMatch(-1)"
          @replace="applyReplaceOne"
          @replace-all="applyReplaceAll"
          @close="closeFindReplace"
        />
        <SourceEditor
          ref="sourceEditorRef"
          v-if="editorMode.mode === 'source' && activeDoc"
          @undo-fallback="undoVisualEditorHistory"
          @redo-fallback="redoVisualEditorHistory"
          :key="`source-${session.activeId ?? 'empty'}`"
          :doc-id="activeDoc.id"
          :model-value="activeDoc.rawMd"
          :initial-selection="activeDoc.sourceSelection"
          class="mira-editor editor source-editor-shell"
          @update:model-value="onSourceUpdate"
        />
        <EditorContent
          v-else-if="activeEditor"
          :key="session.activeId ?? 'empty'"
          :editor="activeEditor"
          class="mira-editor editor"
        />
        <div v-else class="editor-empty">
          <div class="editor-empty-card">
            <h2>Mira</h2>
            <p>所见即所得的 Markdown 编辑器</p>
            <p class="editor-empty-actions">
              打开文件（Ctrl+O）或打开文件夹（Ctrl+Shift+O）开始写作
            </p>
          </div>
        </div>
      </div>
      <OutlinePanel
        v-if="showOutline && activeDoc"
        :items="outlineItems"
        @select="scrollToMarkdownOffset"
        @close="toggleOutline"
      />
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
    <ShortcutSettings v-if="showShortcutSettings" @close="showShortcutSettings = false" />
    <CommandPalette
      v-if="showCommandPalette"
      :shortcuts="menuShortcutLabels"
      :open-paths="session.docs.flatMap((doc) => doc.filePath ? [doc.filePath] : [])"
      :recent-paths="recent.recentPaths"
      :workspace-paths="paletteWorkspacePaths"
      :loading="paletteLoading"
      :error="paletteError"
      @close="closeCommandPalette"
      @run-command="runPaletteCommand"
      @open-file="openPaletteFile"
      @query-change="handlePaletteQueryChange"
    />
    <footer class="status">
      <span class="status-path" :title="currentPathLabel">{{ currentPathLabel }}</span>
      <span class="status-save" :class="{ dirty }">{{ saveStateLabel }}</span>
      <span v-if="activeDoc" class="status-stats" title="字数统计">{{ statsLabel }}</span>
    </footer>
  </div>
</template>
