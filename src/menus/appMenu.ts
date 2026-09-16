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

/**
 * Typora 风格菜单：文件 / 编辑 / 格式 / 视图 / 工具 / 帮助。
 * 「设置」独立入口（含通用偏好 + 快捷键），不再混在「快捷键设置」里。
 */
export function buildAppMenuGroups(state: AppMenuState): AppMenuGroup[] {
  const { recentPaths, shortcuts, hasActiveDoc, hasOpenTabs } = state;
  const editorMode = state.editorMode ?? "visual";
  return [
    {
      id: "file",
      label: "文件",
      items: [
        { id: "newDoc", label: "新建", shortcut: shortcut(shortcuts, "newDoc") },
        { id: "openFile", label: "打开文件…", shortcut: shortcut(shortcuts, "openFile") },
        { id: "openFolder", label: "打开文件夹…", shortcut: shortcut(shortcuts, "openFolder") },
        {
          id: "saveFile",
          label: "保存",
          shortcut: shortcut(shortcuts, "saveFile"),
          disabled: !hasActiveDoc,
          separatorBefore: true,
        },
        {
          id: "closeTab",
          label: "关闭标签",
          shortcut: shortcut(shortcuts, "closeTab"),
          disabled: !hasOpenTabs,
          separatorBefore: true,
        },
        {
          id: "openSettings",
          label: "设置…",
          shortcut: shortcut(shortcuts, "openSettings"),
          separatorBefore: true,
          title: "主题、字号、自动保存、图片策略、自定义 CSS、快捷键",
        },
        { label: "最近打开", section: true, separatorBefore: true },
        ...recentItems(recentPaths),
      ],
    },
    {
      id: "export",
      label: "导出",
      items: [
        { id: "exportHtml", label: "HTML…", disabled: !hasActiveDoc },
        { id: "exportPdf", label: "PDF（打印）…", disabled: !hasActiveDoc },
        { id: "exportDoc", label: "Word (.doc)…", disabled: !hasActiveDoc },
        { id: "exportPng", label: "PNG 图片…", disabled: !hasActiveDoc },
      ],
    },
    {
      id: "edit",
      label: "编辑",
      items: [
        { id: "undo", label: "撤销", disabled: !hasActiveDoc },
        { id: "redo", label: "重做", disabled: !hasActiveDoc },
        { id: "toggleBold", label: "加粗", shortcut: shortcut(shortcuts, "toggleBold"), disabled: !hasActiveDoc, separatorBefore: true },
        { id: "toggleItalic", label: "斜体", shortcut: shortcut(shortcuts, "toggleItalic"), disabled: !hasActiveDoc },
        { id: "toggleInlineCode", label: "行内代码", shortcut: shortcut(shortcuts, "toggleInlineCode"), disabled: !hasActiveDoc },
        { id: "insertLink", label: "插入链接…", shortcut: shortcut(shortcuts, "insertLink"), disabled: !hasActiveDoc },
        {
          id: "findInDocument",
          label: "查找…",
          shortcut: shortcut(shortcuts, "findInDocument"),
          disabled: !hasActiveDoc,
          separatorBefore: true,
        },
        {
          id: "replaceInDocument",
          label: "替换…",
          shortcut: shortcut(shortcuts, "replaceInDocument"),
          disabled: !hasActiveDoc,
        },
        {
          id: "openWorkspaceSearch",
          label: "工作区搜索…",
          shortcut: shortcut(shortcuts, "openWorkspaceSearch"),
          separatorBefore: true,
        },
      ],
    },
    {
      id: "format",
      label: "格式",
      items: [
        { id: "toggleBulletList", label: "无序列表", disabled: !hasActiveDoc },
        { id: "toggleOrderedList", label: "有序列表", disabled: !hasActiveDoc },
        { id: "toggleBlockquote", label: "引用", disabled: !hasActiveDoc },
        { id: "toggleCodeBlock", label: "代码块", disabled: !hasActiveDoc },
      ],
    },
    {
      id: "view",
      label: "视图",
      items: [
        {
          id: "toggleOutline",
          label: "大纲",
          shortcut: shortcut(shortcuts, "toggleOutline"),
        },
        {
          id: "toggleFocusMode",
          label: "专注模式",
          shortcut: shortcut(shortcuts, "toggleFocusMode"),
        },
        {
          id: "toggleTypewriterMode",
          label: "打字机模式",
          shortcut: shortcut(shortcuts, "toggleTypewriterMode"),
        },
        {
          id: "toggleSourceMode",
          label: editorMode === "source" ? "所见即所得" : "源码模式",
          shortcut: shortcut(shortcuts, "toggleSourceMode"),
          active: editorMode === "source",
          separatorBefore: true,
        },
        {
          id: "toggleTheme",
          label: "切换浅色/深色",
          shortcut: shortcut(shortcuts, "toggleTheme"),
          separatorBefore: true,
        },
      ],
    },
    {
      id: "tools",
      label: "工具",
      items: [
        {
          id: "openCommandPalette",
          label: "命令面板",
          shortcut: shortcut(shortcuts, "openCommandPalette"),
        },
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
