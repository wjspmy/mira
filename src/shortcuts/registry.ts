export type ShortcutGroup = "file" | "tabs" | "edit" | "app";

export type ShortcutCommandId =
  | "newDoc"
  | "openFile"
  | "openFolder"
  | "saveFile"
  | "closeTab"
  | "nextTab"
  | "prevTab"
  | "tab1"
  | "tab2"
  | "tab3"
  | "tab4"
  | "tab5"
  | "tab6"
  | "tab7"
  | "tab8"
  | "tab9"
  | "toggleBold"
  | "toggleItalic"
  | "toggleInlineCode"
  | "insertLink"
  | "toggleBulletList"
  | "toggleOrderedList"
  | "toggleBlockquote"
  | "toggleCodeBlock"
  | "toggleTheme"
  | "openShortcutSettings";

export interface ShortcutCommand {
  id: ShortcutCommandId;
  title: string;
  group: ShortcutGroup;
  defaultShortcut: string | null;
  description?: string;
}

export const SHORTCUT_GROUP_LABELS: Record<ShortcutGroup, string> = {
  file: "文件",
  tabs: "标签页",
  edit: "编辑",
  app: "应用",
};

export const SHORTCUT_COMMANDS: ShortcutCommand[] = [
  { id: "newDoc", title: "新建文档", group: "file", defaultShortcut: "Mod+N" },
  { id: "openFile", title: "打开文件", group: "file", defaultShortcut: "Mod+O" },
  { id: "openFolder", title: "打开文件夹", group: "file", defaultShortcut: "Mod+Shift+O" },
  { id: "saveFile", title: "保存当前文档", group: "file", defaultShortcut: "Mod+S" },
  { id: "closeTab", title: "关闭当前标签页", group: "tabs", defaultShortcut: "Mod+W" },
  { id: "nextTab", title: "切换到下一个标签页", group: "tabs", defaultShortcut: "Mod+Tab" },
  { id: "prevTab", title: "切换到上一个标签页", group: "tabs", defaultShortcut: "Mod+Shift+Tab" },
  { id: "tab1", title: "切换到第 1 个标签页", group: "tabs", defaultShortcut: "Mod+1" },
  { id: "tab2", title: "切换到第 2 个标签页", group: "tabs", defaultShortcut: "Mod+2" },
  { id: "tab3", title: "切换到第 3 个标签页", group: "tabs", defaultShortcut: "Mod+3" },
  { id: "tab4", title: "切换到第 4 个标签页", group: "tabs", defaultShortcut: "Mod+4" },
  { id: "tab5", title: "切换到第 5 个标签页", group: "tabs", defaultShortcut: "Mod+5" },
  { id: "tab6", title: "切换到第 6 个标签页", group: "tabs", defaultShortcut: "Mod+6" },
  { id: "tab7", title: "切换到第 7 个标签页", group: "tabs", defaultShortcut: "Mod+7" },
  { id: "tab8", title: "切换到第 8 个标签页", group: "tabs", defaultShortcut: "Mod+8" },
  { id: "tab9", title: "切换到第 9 个标签页", group: "tabs", defaultShortcut: "Mod+9" },
  { id: "toggleBold", title: "加粗", group: "edit", defaultShortcut: "Mod+B" },
  { id: "toggleItalic", title: "斜体", group: "edit", defaultShortcut: "Mod+I" },
  { id: "toggleInlineCode", title: "行内代码", group: "edit", defaultShortcut: "Mod+E" },
  { id: "insertLink", title: "插入链接", group: "edit", defaultShortcut: "Mod+K" },
  { id: "toggleBulletList", title: "切换无序列表", group: "edit", defaultShortcut: null },
  { id: "toggleOrderedList", title: "切换有序列表", group: "edit", defaultShortcut: null },
  { id: "toggleBlockquote", title: "切换引用", group: "edit", defaultShortcut: null },
  { id: "toggleCodeBlock", title: "切换代码块", group: "edit", defaultShortcut: null },
  { id: "toggleTheme", title: "切换浅色/深色主题", group: "app", defaultShortcut: "Mod+Shift+L" },
  { id: "openShortcutSettings", title: "打开快捷键设置", group: "app", defaultShortcut: "Mod+," },
];

export const SHORTCUT_COMMAND_BY_ID = Object.fromEntries(
  SHORTCUT_COMMANDS.map((command) => [command.id, command]),
) as Record<ShortcutCommandId, ShortcutCommand>;
