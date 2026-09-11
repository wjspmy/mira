/** 斜杠命令菜单项（Vditor / Notion 风格 `/`） */
export interface SlashCommand {
  id: string;
  label: string;
  hint?: string;
  keywords: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: "heading1", label: "一级标题", hint: "#", keywords: ["h1", "heading", "标题", "1"] },
  { id: "heading2", label: "二级标题", hint: "##", keywords: ["h2", "heading", "标题", "2"] },
  { id: "heading3", label: "三级标题", hint: "###", keywords: ["h3", "heading", "标题", "3"] },
  { id: "bulletList", label: "无序列表", hint: "-", keywords: ["ul", "list", "列表"] },
  { id: "orderedList", label: "有序列表", hint: "1.", keywords: ["ol", "list", "列表"] },
  { id: "taskList", label: "任务列表", hint: "- [ ]", keywords: ["task", "todo", "任务"] },
  { id: "blockquote", label: "引用", hint: ">", keywords: ["quote", "引用"] },
  { id: "codeBlock", label: "代码块", hint: "```", keywords: ["code", "代码"] },
  { id: "insertTable", label: "表格", hint: "| |", keywords: ["table", "表格"] },
  { id: "hr", label: "分隔线", hint: "---", keywords: ["hr", "rule", "分隔"] },
  { id: "insertMermaid", label: "Mermaid 图", hint: "graph", keywords: ["mermaid", "图", "流程"] },
  { id: "insertMathBlock", label: "块级公式", hint: "$$", keywords: ["math", "latex", "公式"] },
  { id: "alertNote", label: "提示块 [!NOTE]", hint: "Note", keywords: ["note", "alert", "提示"] },
  { id: "alertWarning", label: "警告块 [!WARNING]", hint: "Warning", keywords: ["warning", "alert", "警告"] },
  { id: "alertTip", label: "技巧块 [!TIP]", hint: "Tip", keywords: ["tip", "alert", "技巧"] },
  { id: "insertDetails", label: "折叠块", hint: "details", keywords: ["details", "折叠", "collapse"] },
  { id: "insertToc", label: "生成目录", hint: "TOC", keywords: ["toc", "目录", "outline"] },
  { id: "openEmoji", label: "Emoji", hint: "😀", keywords: ["emoji", "表情", "笑脸"] },
  { id: "insertFrontMatter", label: "Front Matter", hint: "---", keywords: ["yaml", "frontmatter", "元数据"] },
];

export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => {
    if (c.label.toLowerCase().includes(q)) return true;
    if (c.id.toLowerCase().includes(q)) return true;
    return c.keywords.some((k) => k.includes(q) || q.includes(k));
  });
}
