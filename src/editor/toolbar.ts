export type EditorToolbarAction =
  | "heading1"
  | "heading2"
  | "heading3"
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "link"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "codeBlock"
  | "insertTable"
  | "alertNote"
  | "alertWarning"
  | "alertTip"
  | "hr";

export interface ToolbarButton {
  id: EditorToolbarAction;
  label: string;
  title: string;
  group: "history" | "heading" | "inline" | "block" | "insert";
}

export const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { id: "heading1", label: "H1", title: "一级标题", group: "heading" },
  { id: "heading2", label: "H2", title: "二级标题", group: "heading" },
  { id: "heading3", label: "H3", title: "三级标题", group: "heading" },
  { id: "bold", label: "B", title: "加粗 (Ctrl+B)", group: "inline" },
  { id: "italic", label: "I", title: "斜体 (Ctrl+I)", group: "inline" },
  { id: "strike", label: "S", title: "删除线", group: "inline" },
  { id: "code", label: "<>", title: "行内代码", group: "inline" },
  { id: "link", label: "🔗", title: "插入链接", group: "inline" },
  { id: "bulletList", label: "•≡", title: "无序列表", group: "block" },
  { id: "orderedList", label: "1.", title: "有序列表", group: "block" },
  { id: "taskList", label: "☑", title: "任务列表", group: "block" },
  { id: "blockquote", label: "❝", title: "引用", group: "block" },
  { id: "codeBlock", label: "{ }", title: "代码块", group: "block" },
  { id: "hr", label: "—", title: "分隔线", group: "insert" },
  { id: "insertTable", label: "▦", title: "插入 2×2 表格", group: "insert" },
  { id: "alertNote", label: "i", title: "GitHub 提示块 [!NOTE]", group: "insert" },
  { id: "alertWarning", label: "!", title: "GitHub 警告块 [!WARNING]", group: "insert" },
  { id: "alertTip", label: "★", title: "GitHub 技巧块 [!TIP]", group: "insert" },
];

export const TOOLBAR_GROUPS: Array<{ id: ToolbarButton["group"]; buttons: ToolbarButton[] }> = (
  ["heading", "inline", "block", "insert"] as const
).map((group) => ({
  id: group,
  buttons: TOOLBAR_BUTTONS.filter((b) => b.group === group),
}));

export const GITHUB_ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;
export type GithubAlertType = (typeof GITHUB_ALERT_TYPES)[number];

/** 从引用块首段识别 GitHub Alerts 标记 */
export function detectGithubAlert(text: string): GithubAlertType | null {
  const match = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(text);
  return match ? (match[1].toUpperCase() as GithubAlertType) : null;
}

export function buildAlertBlockquote(type: GithubAlertType, body = "内容"): string {
  return `> [!${type}]\n> ${body}\n`;
}
