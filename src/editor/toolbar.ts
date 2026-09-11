export type EditorToolbarAction =
  | "undo"
  | "redo"
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6"
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "link"
  | "image"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "codeBlock"
  | "hr"
  | "insertTable"
  | "addTableRow"
  | "addTableColumn"
  | "deleteTableRow"
  | "deleteTableColumn"
  | "insertMermaid"
  | "insertMathBlock"
  | "insertMathInline"
  | "insertDetails"
  | "insertToc"
  | "alertNote"
  | "alertWarning"
  | "alertTip"
  | "toggleOutline"
  | "toggleSourceMode"
  | "toggleFocusMode"
  | "toggleTypewriterMode"
  | "openFind"
  | "openWorkspaceSearch"
  | "openEmoji"
  | "insertFrontMatter";

/** 主工具栏：高频命令（Toast UI / Vditor 顺序） */
export interface ToolbarButtonDef {
  id: EditorToolbarAction;
  icon: string;
  title: string;
  toggle?: boolean;
  /** 紧跟前面按钮的下拉，而不是独立按钮 */
  dropdown?: "heading" | "more";
}

/** 标题下拉项 */
export const HEADING_MENU: Array<{ id: EditorToolbarAction; label: string }> = [
  { id: "paragraph", label: "正文" },
  { id: "heading1", label: "一级标题" },
  { id: "heading2", label: "二级标题" },
  { id: "heading3", label: "三级标题" },
  { id: "heading4", label: "四级标题" },
  { id: "heading5", label: "五级标题" },
  { id: "heading6", label: "六级标题" },
];

/** 「更多」菜单：低频插入与表格操作 */
export const MORE_MENU: Array<{ id: EditorToolbarAction; label: string; separatorBefore?: boolean }> = [
  { id: "insertTable", label: "插入表格" },
  { id: "addTableRow", label: "表格：下方加行" },
  { id: "addTableColumn", label: "表格：右侧加列" },
  { id: "deleteTableRow", label: "表格：删除行", separatorBefore: true },
  { id: "deleteTableColumn", label: "表格：删除列" },
  { id: "insertMathInline", label: "行内公式 $…$", separatorBefore: true },
  { id: "insertMathBlock", label: "块级公式 $$…$$" },
  { id: "insertMermaid", label: "Mermaid 图" },
  { id: "insertDetails", label: "折叠块", separatorBefore: true },
  { id: "insertToc", label: "生成目录 TOC" },
  { id: "alertNote", label: "提示块 [!NOTE]", separatorBefore: true },
  { id: "alertTip", label: "技巧块 [!TIP]" },
  { id: "alertWarning", label: "警告块 [!WARNING]" },
  { id: "toggleFocusMode", label: "专注模式", separatorBefore: true },
  { id: "toggleTypewriterMode", label: "打字机模式" },
  { id: "openWorkspaceSearch", label: "工作区搜索…" },
  { id: "openEmoji", label: "Emoji…", separatorBefore: true },
  { id: "insertFrontMatter", label: "插入 Front Matter" },
];

/** 左侧主工具栏按钮（含 heading 触发器） */
export const MAIN_TOOLBAR_BUTTONS: ToolbarButtonDef[] = [
  { id: "undo", icon: "undo", title: "撤销 (Ctrl+Z)" },
  { id: "redo", icon: "redo", title: "重做 (Ctrl+Y)" },

  { id: "heading1", icon: "heading", title: "标题级别", dropdown: "heading" },

  { id: "bold", icon: "bold", title: "加粗 (Ctrl+B)", toggle: true },
  { id: "italic", icon: "italic", title: "斜体 (Ctrl+I)", toggle: true },
  { id: "strike", icon: "strike", title: "删除线", toggle: true },
  { id: "code", icon: "code", title: "行内代码", toggle: true },

  { id: "bulletList", icon: "ul", title: "无序列表", toggle: true },
  { id: "orderedList", icon: "ol", title: "有序列表", toggle: true },
  { id: "taskList", icon: "task", title: "任务列表", toggle: true },
  { id: "blockquote", icon: "quote", title: "引用", toggle: true },
  { id: "codeBlock", icon: "codeBlock", title: "代码块", toggle: true },
  { id: "hr", icon: "hr", title: "分隔线" },

  { id: "link", icon: "link", title: "链接 (Ctrl+K)" },
  { id: "image", icon: "image", title: "图片" },
  { id: "insertTable", icon: "table", title: "表格" },

  { id: "openFind", icon: "search", title: "查找 (Ctrl+F)" },
];

/** 右侧工具（大纲 / 源码 / 更多） */
export const UTILITY_BUTTONS: ToolbarButtonDef[] = [
  { id: "toggleOutline", icon: "outline", title: "大纲" },
  { id: "toggleSourceMode", icon: "source", title: "切换源码模式" },
  { id: "insertMermaid", icon: "more", title: "更多插入…", dropdown: "more" },
];

export type ToolbarActiveMap = Partial<Record<EditorToolbarAction, boolean>>;

/** 内联 SVG path（16×16，stroke） */
export const TOOLBAR_ICONS: Record<string, string> = {
  undo: "M3 7h7a3 3 0 010 6H7M3 7l3-3M3 7l3 3",
  redo: "M13 7H6a3 3 0 000 6h3M13 7l-3-3M13 7l-3 3",
  heading: "M4 3.5v9M9 3.5v9M4 8h5",
  bold: "M5 3h4a2.5 2.5 0 010 5H5V3zm0 5h5a2.5 2.5 0 010 5H5V8z",
  italic: "M10 3H6M10 13H6M9 3l-2 10",
  strike: "M3 8h10M5 5.5A2.5 2.5 0 018 4c1.4 0 2.2.7 2.5 1.5M11 10.5A2.5 2.5 0 018 12c-1.4 0-2.2-.7-2.5-1.5",
  code: "M5.5 5L3 8l2.5 3M10.5 5L13 8l-2.5 3",
  ul: "M5 4h8M5 8h8M5 12h8M3 4h.01M3 8h.01M3 12h.01",
  ol: "M6 4h7M6 8h7M6 12h7M3 3.5h1V6M3 9.5h1.5L3 12h1.5",
  task: "M3 4h1v3M3 10.5h2l-2 2.5h2M6 4h7M6 8h7M6 12h7",
  quote: "M4 5h2v3H4a1 1 0 00-1 1v1h3V6a4 4 0 00-2-3zm6 0h2v3h-2a1 1 0 00-1 1v1h3V6a4 4 0 00-2-3z",
  codeBlock: "M5 4h6v2H5V4zm0 4h6v2H5V8zm0 4h4v2H5v-2z",
  hr: "M3 8h10",
  link: "M6.5 9.5l3-3M7 5.5l1-1a2.8 2.8 0 014 4l-1 1M9 10.5l-1 1a2.8 2.8 0 01-4-4l1-1",
  image: "M3 4h10v8H3V4zm2 6l2.5-3 2 2.5L11 7l2 3",
  table: "M3 3h10v10H3V3zm0 3.5h10M3 9.5h10M8 3v10",
  search: "M7 3a4 4 0 100 8 4 4 0 000-8zM10 10l3 3",
  outline: "M3 4h10M3 8h7M3 12h9",
  source: "M4 4l-2 4 2 4M12 4l2 4-2 4M9 3l-2 10",
  more: "M4 8h.01M8 8h.01M12 8h.01",
};

export const GITHUB_ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;
export type GithubAlertType = (typeof GITHUB_ALERT_TYPES)[number];

export function detectGithubAlert(text: string): GithubAlertType | null {
  const match = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(text);
  return match ? (match[1].toUpperCase() as GithubAlertType) : null;
}

export function buildAlertBlockquote(type: GithubAlertType, body = "内容"): string {
  return `> [!${type}]\n> ${body}\n`;
}

export const DEFAULT_MERMAID_SNIPPET = `graph TD
  A[开始] --> B{判断}
  B -->|是| C[执行]
  B -->|否| D[结束]
`;

export const DEFAULT_MATH_BLOCK = "E = mc^2";

/** 由当前激活态推断标题下拉显示文案 */
export function headingLabelFromActive(active?: ToolbarActiveMap): string {
  if (active?.paragraph) return "正文";
  for (let i = 1; i <= 6; i++) {
    if (active?.[`heading${i}` as EditorToolbarAction]) return `H${i}`;
  }
  return "标题";
}
