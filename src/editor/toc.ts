import { extractOutline } from "./outline";

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~\[\]()]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** 生成 GitHub 风格 TOC Markdown */
export function buildTocMarkdown(markdown: string, maxLevel = 3): string {
  const items = extractOutline(markdown).filter((item) => item.level >= 1 && item.level <= maxLevel);
  if (!items.length) return "";
  const lines = items.map((item) => {
    const indent = "  ".repeat(Math.max(0, item.level - 1));
    const slug = slugifyHeading(item.text);
    return `${indent}- [${item.text}](#${slug})`;
  });
  return `## 目录\n\n${lines.join("\n")}\n`;
}
