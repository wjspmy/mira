// PM 文档 → Markdown 序列化器（按设计 §14.3 第二方向）
// 目标：严格可控的输出，保证 git diff 只反映真实编辑、无格式抖动。
// 解析方向仍由 tiptap-markdown 负责（它已驱动 WYSIWYG 渲染），见 App.vue。
//
// 设计取舍：不直接用 remark-stringify 序列化 PM 文档（PM↔mdast 两棵异构树，
// 转换层开销大且易丢边角）。这里采用"自研遍历器"遍历 PM 节点树，
// 按规则输出 GFM + 数学 Markdown；用 RemarkParser 重新解析做规范性归一后做等价判定。
//
// 约定的规范化（白名单允许）：
//  - 列表统一 2 空格缩进
//  - 行尾去尾空格（hard_break 用行尾两空格显式保留为 `\`）
//  - 围栏代码块统一用 ``` 三反引号，语言标在首行
//
// 仍待补（M1-5 仅覆盖核心，留 TODO）：
//  - frontmatter / 原 HTML 块透传
//  - 嵌套强调的消歧优先级
//  - 软换行（breaks:true 下源码 \n 被解析为 hardBreak，软/硬换行在 blockquote 内会产生 \ 的语义差）

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkStringify from "remark-stringify";
import { DOMParser as PmDOMParser, Node as PmNode, Mark } from "@tiptap/pm/model";
import { Editor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { Markdown as TiptapMarkdown } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { MathInline, MathBlock, mathPlugin } from "./math";

const lowlight = createLowlight(common);

// 构建共享 schema（解析用），保证序列化器内省的 node/mark 名与编辑器一致
let _editor: Editor | null = null;
let _schema: any = null;
let _parser: any = null;

function ensureEditor(): Editor {
  if (!_editor) {
    _editor = new Editor({
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        CodeBlockLowlight.configure({ lowlight }),
        Table, TableRow, TableHeader, TableCell,
        TaskList, TaskItem.configure({ nested: true }),
        Link.configure({ openOnClick: false }),
        MathInline, MathBlock,
        TiptapMarkdown.configure({ html: false, breaks: true }),
      ],
      content: "",
      editable: false,
    });
    _schema = _editor.schema;
    _parser = (_editor.storage as any).markdown?.parser;
  }
  return _editor;
}

// remark 流水线：解析 → 规范化 → 序列化。round-trip 等价判据用它做 mdast 归一。
const remark = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkStringify, {
    bullet: "-",
    emphasis: "*",
    strong: "*",
    fence: "`",
    fences: true,
    listItemIndent: "one",
    rule: "-",
    resourceLink: "preferred",
  });

// ---------- 自研遍历器 ----------
class Serializer {
  private lines: string[] = [];
  private listIndent = 0;

  private push(s: string) {
    this.lines.push(s);
  }
  private blank() {
    // 列表内部不插空行（保持 tight；loose 列表的空行规范化后续再支持）
    if (this.listIndent > 0) return;
    if (this.lines.length && this.lines[this.lines.length - 1] !== "") this.lines.push("");
  }

  // 行内：把 marks 转成包裹符
  private inline(node: PmNode): string {
    if (node.isText && node.text) {
      let t = node.text;
      for (const m of node.marks as Mark[]) {
        t = wrapMark(m, t);
      }
      return t;
    }
    // 非文本行内节点
    switch (node.type.name) {
      case "hardBreak":
        return "\\\n"; // 反斜杠 + 换行 = 硬换行（remark-stringify 风格）
      case "mathInline":
        return `$${node.attrs.latex}$`;
      case "image":
        return imageMd(node);
      default:
        if (node.content.size > 0) return this.inlineContent(node);
        return (node as any).text ?? "";
    }
  }

  private inlineContent(parent: PmNode): string {
    let out = "";
    parent.forEach((child) => {
      out += this.inline(child);
    });
    return out;
  }

  serialize(doc: PmNode): string {
    this.lines = [];
    this.block(doc);
    // 规范化：统一行尾 \n、去尾随空行
    let text = this.lines.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
    text = text.replace(/^\n+/, "").replace(/\n+$/, "\n");
    return text;
  }

  private block(node: PmNode) {
    switch (node.type.name) {
      case "doc":
        node.forEach((child) => this.block(child));
        break;
      case "heading":
        this.push("#".repeat(node.attrs.level) + " " + this.inlineContent(node));
        this.blank();
        break;
      case "paragraph": {
        // 段落内 hardBreak 拆成多行（每段以 `\` 结尾），保证行级前缀（如 blockquote）能正确应用
        let seg = "";
        node.forEach((child) => {
          if (child.type.name === "hardBreak") {
            this.push(seg + "\\");
            seg = "";
          } else {
            seg += this.inline(child);
          }
        });
        this.push(seg);
        this.blank();
        break;
      }
      case "blockquote": {
        const saved = this.lines.length;
        node.forEach((child) => this.block(child));
        // 给本块内新加的行加 "> " 前缀
        for (let i = saved; i < this.lines.length; i++) {
          this.lines[i] = (this.lines[i] === "" ? ">" : "> " + this.lines[i]);
        }
        this.blank();
        break;
      }
      case "bulletList":
      case "orderedList": {
        const savedIndent = this.listIndent;
        this.listIndent++;
        this.list(node, node.type.name === "orderedList");
        this.listIndent = savedIndent;
        this.blank();
        break;
      }
      case "listItem": {
        // 内含 paragraph 或子列表；先取段落作为首行，子列表缩进
        const indent = "  ".repeat(this.listIndent); // 2 空格/级
        const saved = this.lines.length;
        const children: PmNode[] = [];
        node.forEach((c) => children.push(c));
        const paras = children.filter((c) => c.type.name === "paragraph");
        const sublists = children.filter((c) => ["bulletList", "orderedList"].includes(c.type.name));
        const others = children.filter((c) => !["paragraph", "bulletList", "orderedList"].includes(c.type.name));
        let firstLine = "";
        if (paras.length) firstLine = this.inlineContent(paras[0]);
        else if (others.length) firstLine = "";

        this.push(indent + this.pendingMarker + firstLine);
        // 其余段落（松散列表）
        for (let i = 1; i < paras.length; i++) {
          this.push(indent + "  " + this.inlineContent(paras[i]));
          this.blank();
        }
        // 子列表（listIndent 已在父分支递增）
        for (const sl of sublists) this.block(sl);
        for (const o of others) {
          if (o.type.name === "codeBlock") {
            this.push(indent + "  ```" + (o.attrs.language || ""));
            this.push(indent + "  " + o.textContent);
            this.push(indent + "  ```");
          } else {
            this.block(o);
          }
        }
        void saved;
        break;
      }
      case "taskList": {
        const savedIndent = this.listIndent;
        this.listIndent++;
        this.list(node, false, true);
        this.listIndent = savedIndent;
        this.blank();
        break;
      }
      case "taskItem": {
        const indent = "  ".repeat(this.listIndent);
        const box = node.attrs.checked ? "[x]" : "[ ]";
        const children: PmNode[] = [];
        node.forEach((c) => children.push(c));
        const paras = children.filter((c) => c.type.name === "paragraph");
        const sublists = children.filter((c) => ["bulletList", "orderedList", "taskList"].includes(c.type.name));
        this.push(`${indent}- ${box} ${paras.length ? this.inlineContent(paras[0]) : ""}`);
        for (const sl of sublists) this.block(sl);
        break;
      }
      case "codeBlock":
        this.push("```" + (node.attrs.language || ""));
        node.forEach((c) => { if (c.isText) this.push(c.text ?? ""); });
        this.push("```");
        this.blank();
        break;
      case "mathBlock":
        this.push("$$");
        this.push(node.attrs.latex || "");
        this.push("$$");
        this.blank();
        break;
      case "table":
        this.serializeTable(node);
        this.blank();
        break;
      case "horizontalRule":
        this.push("---");
        this.blank();
        break;
      default:
        // 兜底：纯文本
        if (node.content.size > 0) this.push(this.inlineContent(node));
        else this.push("");
    }
  }

  private pendingMarker = "- ";
  private list(node: PmNode, ordered: boolean, task = false) {
    let i = 1;
    node.forEach((child) => {
      this.pendingMarker = task ? "- " : ordered ? `${i++}. ` : "- ";
      this.block(child);
    });
  }

  private serializeTable(node: PmNode) {
    // 假设结构：table > tableRow > (tableHeader | tableCell)
    const rows: PmNode[] = [];
    node.forEach((r) => rows.push(r));
    if (!rows.length) return;

    const cells = (row: PmNode) => {
      const c: PmNode[] = [];
      row.forEach((x) => c.push(x));
      return c.map((cell) => this.inlineContent(cell).replace(/\|/g, "\\|").replace(/\n/g, " "));
    };
    const headerCells = cells(rows[0]);
    const align = (rows[0] as any).attrs?.align; // 暂不深挖对齐
    void align;
    this.push("| " + headerCells.join(" | ") + " |");
    this.push("| " + headerCells.map(() => "---").join(" | ") + " |");
    for (let r = 1; r < rows.length; r++) {
      this.push("| " + cells(rows[r]).join(" | ") + " |");
    }
  }
}

// mark → 包裹符号
function wrapMark(m: Mark, text: string): string {
  switch (m.attrs && m.type.name ? m.type.name : (m as any).type.name) {
    case "bold":
      return `**${text}**`;
    case "italic":
      return `*${text}*`;
    case "strike":
      return `~~${text}~~`;
    case "code":
      return text.includes("`") ? "`` " + text + " ``" : "`" + text + "`";
    case "link":
      return `[${text}](${m.attrs!.href})`;
    default:
      return text;
  }
}

function imageMd(node: PmNode): string {
  const a = (node as any).attrs || {};
  const alt = a.alt || "";
  let md = `![${alt}](${a.src || ""})`;
  if (a.title) md = `![${alt}](${a.src || ""} "${a.title}")`;
  return md;
}

// ---------- 公共 API ----------
/** 将 Markdown 文本解析为 PM 文档对象（复用共享 schema + tiptap-markdown parser → DOM → schema）。 */
export function parseMarkdownToDoc(md: string): PmNode {
  ensureEditor();
  if (!_parser || !_schema) throw new Error("schema/parser not ready");
  const html = _parser.parse(md);
  const container = document.createElement("div");
  container.innerHTML = html;
  return PmDOMParser.fromSchema(_schema).parse(container);
}

/** 将 PM 文档对象序列化为规范 Markdown 文本（自研，严格可控）。 */
export function serializeDocToMarkdown(doc: PmNode): string {
  return new Serializer().serialize(doc);
}

/** round-trip：md → doc → md' ，并返回规范性归一后的两份文本用于比较。 */
export function roundTrip(md: string): { out: string; normIn: string; normOut: string } {
  const doc = parseMarkdownToDoc(md);
  const out = serializeDocToMarkdown(doc);
  const normIn = normalize(md);
  const normOut = normalize(out);
  return { out, normIn, normOut };
}

/** mdast 级规范化：把文本喂回 remark 解析-序列化，吃掉等价的空白/格式差。 */
export function normalize(text: string): string {
  try {
    const f = remark.processSync(text);
    return String(f).replace(/\n+$/, "\n");
  } catch {
    // 解析失败（含不支持语法）→ 返回原文去尾部
    return text.replace(/[ \t]+\n/g, "\n").replace(/\n+$/, "\n");
  }
}

export { mathPlugin };
