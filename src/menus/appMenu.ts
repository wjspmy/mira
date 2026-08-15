import type { ShortcutCommandId } from "../shortcuts/registry";
import { basename } from "../utils/path";

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
  return [
    {
      id: "file",
      label: "文件",
      items: [
        { id: "newDoc", label: "新建", shortcut: shortcut(shortcuts, "newDoc") },
        { id: "openFile", label: "打开文件", shortcut: shortcut(shortcuts, "openFile") },
        { id: "openFolder", label: "打开文件夹", shortcut: shortcut(shortcuts, "openFolder") },
        { id: "saveFile", label: "保存", shortcut: shortcut(shortcuts, "saveFile"), disabled: !hasActiveDoc, separatorBefore: true },
        { id: "closeTab", label: "关闭标签", shortcut: shortcut(shortcuts, "closeTab"), disabled: !hasOpenTabs },
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
        { id: "toggleTheme", label: "切换浅色/深色主题", shortcut: shortcut(shortcuts, "toggleTheme") },
      ],
    },
    {
      id: "tools",
      label: "工具",
      items: [
        { id: "openShortcutSettings", label: "快捷键设置", shortcut: shortcut(shortcuts, "openShortcutSettings") },
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
