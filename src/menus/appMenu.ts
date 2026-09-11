import type { ShortcutCommandId } from "../shortcuts/registry";
import { basename } from "../utils/path";
import type { EditorMode } from "../stores/editor-mode";

export type AppMenuCommandId = ShortcutCommandId | "undo" | "redo" | "aboutMira";

export interface AppMenuItem {
  id?: AppMenuCommandId;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  section?: boolean;
  recentPath?: string;
  title?: string;
  inset?: boolean;
  active?: boolean;
}

export interface AppMenuGroup {
  id: string;
  label: string;
  items: AppMenuItem[];
}

export interface AppMenuState {
  recentPaths: string[];
  shortcuts: Partial<Record<ShortcutCommandId, string>>;
  hasActiveDoc: boolean;
  hasOpenTabs: boolean;
  editorMode?: EditorMode;
}

function shortcut(shortcuts: AppMenuState["shortcuts"], id: ShortcutCommandId) {
  const value = shortcuts[id];
  return value && value !== "未设置" ? value : undefined;
}

function recentItems(recentPaths: string[]): AppMenuItem[] {
  if (!recentPaths.length) {
    return [{ label: "暂无最近打开", disabled: true, inset: true }];
  }
  return recentPaths.map((recentPath) => ({
    label: basename(recentPath),
    title: recentPath,
    recentPath,
    inset: true,
  }));
}

export function buildAppMenuGroups(state: AppMenuState): AppMenuGroup[] {
  const { recentPaths, shortcuts, hasActiveDoc, hasOpenTabs } = state;
  const editorMode = state.editorMode ?? "visual";
  return [
    {
      id: "file",
      label: "文件",
      items: [
        { id: "newDoc", label: "新建", shortcut: shortcut(shortcuts, "newDoc") },
        { id: "openFile", label: "打开文件", shortcut: shortcut(shortcuts, "openFile") },
        { id: "openFolder", label: "打开文件夹", shortcut: shortcut(shortcuts, "openFolder") },
        { id: "saveFile", label: "保存", shortcut: shortcut(shortcuts, "saveFile"), disabled: !hasActiveDoc, separatorBefore: true },
        { id: "exportHtml", label: "导出 HTML…", shortcut: shortcut(shortcuts, "exportHtml"), disabled: !hasActiveDoc },
        { id: "exportPdf", label: "导出 PDF…", shortcut: shortcut(shortcuts, "exportPdf"), disabled: !hasActiveDoc },
        { id: "closeTab", label: "关闭标签", shortcut: shortcut(shortcuts, "closeTab"), disabled: !hasOpenTabs, separatorBefore: true },
        { label: "最近打开", section: true, separatorBefore: true },
        ...recentItems(recentPaths),
      ],
    },
    {
      id: "edit",
      label: "编辑",
      items: [
        { id: "undo", label: "撤销", disabled: !hasActiveDoc },
        { id: "redo", label: "重做", disabled: !hasActiveDoc },
      ],
    },
    {
      id: "format",
      label: "格式",
      items: [
        { id: "toggleBold", label: "加粗", shortcut: shortcut(shortcuts, "toggleBold"), disabled: !hasActiveDoc },
        { id: "toggleItalic", label: "斜体", shortcut: shortcut(shortcuts, "toggleItalic"), disabled: !hasActiveDoc },
        { id: "toggleInlineCode", label: "行内代码", shortcut: shortcut(shortcuts, "toggleInlineCode"), disabled: !hasActiveDoc },
        { id: "insertLink", label: "插入链接", shortcut: shortcut(shortcuts, "insertLink"), disabled: !hasActiveDoc },
        { id: "toggleBulletList", label: "无序列表", shortcut: shortcut(shortcuts, "toggleBulletList"), disabled: !hasActiveDoc, separatorBefore: true },
        { id: "toggleOrderedList", label: "有序列表", shortcut: shortcut(shortcuts, "toggleOrderedList"), disabled: !hasActiveDoc },
        { id: "toggleBlockquote", label: "引用", shortcut: shortcut(shortcuts, "toggleBlockquote"), disabled: !hasActiveDoc },
        { id: "toggleCodeBlock", label: "代码块", shortcut: shortcut(shortcuts, "toggleCodeBlock"), disabled: !hasActiveDoc },
      ],
    },
    {
      id: "view",
      label: "视图",
      items: [
        { id: "toggleSourceMode", label: editorMode === "source" ? "切换到所见即所得" : "切换到源码模式", shortcut: shortcut(shortcuts, "toggleSourceMode"), active: editorMode === "source" },
        { id: "toggleTheme", label: "切换浅色/深色主题", shortcut: shortcut(shortcuts, "toggleTheme") },
      ],
    },
    {
      id: "tools",
      label: "工具",
      items: [
        { id: "openCommandPalette", label: "命令面板", shortcut: shortcut(shortcuts, "openCommandPalette") },
        { id: "openShortcutSettings", label: "快捷键设置", shortcut: shortcut(shortcuts, "openShortcutSettings"), separatorBefore: true },
      ],
    },
    {
      id: "help",
      label: "帮助",
      items: [
        { id: "aboutMira", label: "关于 Mira" },
      ],
    },
  ];
}
