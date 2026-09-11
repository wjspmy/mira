import type { Editor } from "@tiptap/core";
import { findMatches, type FindMatch } from "./find-replace";

export interface EditorMatch extends FindMatch {
  /** ProseMirror 位置（仅所见即所得） */
  pmFrom?: number;
  pmTo?: number;
}

function buildRegex(query: string, options: { useRegex?: boolean; caseSensitive?: boolean }): RegExp | null {
  if (!query) return null;
  const flags = options.caseSensitive ? "g" : "gi";
  try {
    const source = options.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

/** 在 ProseMirror 文本节点中收集匹配，并给出可滚动的 PM 位置。 */
export function collectVisualMatches(
  ed: Editor,
  query: string,
  options: { useRegex?: boolean; caseSensitive?: boolean } = {},
): Array<{ from: number; to: number; text: string }> {
  const re = buildRegex(query, options);
  if (!re) return [];
  const out: Array<{ from: number; to: number; text: string }> = [];
  ed.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    re.lastIndex = 0;
    for (const m of node.text.matchAll(re)) {
      if (m.index === undefined) continue;
      const from = pos + m.index;
      const to = from + m[0].length;
      out.push({ from, to, text: m[0] });
      if (out.length > 2000) return false;
    }
    return true;
  });
  return out;
}

/** 把选区滚到匹配处并高亮（所见即所得）。 */
export function revealVisualMatch(ed: Editor, match: { from: number; to: number }) {
  const docSize = ed.state.doc.content.size;
  const from = Math.min(Math.max(0, match.from), docSize);
  const to = Math.min(Math.max(from, match.to), docSize);
  ed.chain().setTextSelection({ from, to }).scrollIntoView().focus().run();
}

/** 源码模式：用 Markdown 文本匹配，返回字符偏移。 */
export function collectSourceMatches(
  markdown: string,
  query: string,
  options: { useRegex?: boolean; caseSensitive?: boolean } = {},
): EditorMatch[] {
  return findMatches(markdown, query, options);
}
