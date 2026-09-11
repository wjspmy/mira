import { Editor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { createLowlight, common } from "lowlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { MathInline, MathBlock } from "../editor/math";
import { Markdown } from "tiptap-markdown";

const lowlight = createLowlight(common);

export interface ExportHtmlOptions {
  title: string;
  theme?: "light" | "dark";
}

/**
 * 用与主编辑器一致的扩展把 Markdown 转成 HTML 片段。
 * 图片使用原始相对路径（不走 convertFileSrc），便于导出时内联。
 */
export function markdownToHtmlFragment(markdown: string): string {
  const temp = new Editor({
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
      Image.configure({ inline: false }),
      MathInline,
      MathBlock,
      Markdown.configure({ html: false, breaks: true }),
    ],
    content: markdown || "",
  });
  try {
    return temp.getHTML();
  } finally {
    temp.destroy();
  }
}

const EXPORT_BASE_CSS = `
:root { color-scheme: light; }
body {
  margin: 0 auto;
  max-width: 820px;
  padding: 48px 28px 80px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  line-height: 1.7;
  color: #1f2328;
  background: #ffffff;
}
h1,h2,h3,h4,h5,h6 { line-height: 1.3; margin: 1.4em 0 0.6em; }
p { margin: 0.8em 0; }
a { color: #2563eb; }
code {
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  font-size: 0.92em;
  background: #f6f8fa;
  padding: 0.15em 0.35em;
  border-radius: 4px;
}
pre {
  background: #f6f8fa;
  padding: 14px 16px;
  border-radius: 8px;
  overflow: auto;
}
pre code { background: transparent; padding: 0; }
blockquote {
  margin: 1em 0;
  padding: 0.2em 1em;
  color: #6b7280;
  border-left: 4px solid #d0d7de;
}
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #d0d7de; padding: 6px 10px; }
th { background: #f6f8fa; }
img { max-width: 100%; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 1.6em 0; }
.katex-display { overflow-x: auto; overflow-y: hidden; }
@media print {
  body { padding: 0 12mm; }
  a { color: inherit; text-decoration: none; }
}
`.trim();

export function wrapStandaloneHtml(fragment: string, options: ExportHtmlOptions): string {
  const title = options.title || "Mira Export";
  const bodyBg = options.theme === "dark" ? "#0d1117" : "#ffffff";
  const bodyFg = options.theme === "dark" ? "#c9d1d9" : "#1f2328";
  const css =
    options.theme === "dark"
      ? EXPORT_BASE_CSS.replaceAll("color: #1f2328", `color: ${bodyFg}`).replaceAll(
          "background: #ffffff",
          `background: ${bodyBg}`,
        )
      : EXPORT_BASE_CSS;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${css}
</style>
</head>
<body>
<article class="mira-export">
${fragment}
</article>
</body>
</html>
`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Word 可直接打开的 HTML（.doc），零额外依赖。 */
export function wrapWordDocument(fragment: string, options: ExportHtmlOptions): string {
  const title = options.title || "Mira Export";
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
body { font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 12pt; line-height: 1.6; }
h1 { font-size: 18pt; }
h2 { font-size: 15pt; }
h3 { font-size: 13pt; }
pre { font-family: Consolas, monospace; background: #f5f5f5; padding: 8pt; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #999; padding: 4pt 6pt; }
img { max-width: 100%; }
</style>
</head>
<body>
${fragment}
</body>
</html>
`;
}

/** 把 base64 转 Uint8Array，供 write_file_bytes 使用。 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 通过隐藏 iframe 调起系统打印对话框（可另存为 PDF）。 */
export function printHtmlDocument(html: string): boolean {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;";
  document.body.appendChild(iframe);
  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    iframe.remove();
    return false;
  }
  frameWindow.document.open();
  frameWindow.document.write(html);
  frameWindow.document.close();
  try {
    frameWindow.focus();
    frameWindow.print();
    return true;
  } catch {
    return false;
  } finally {
    window.setTimeout(() => iframe.remove(), 1500);
  }
}
