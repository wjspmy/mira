import type { Editor } from "@tiptap/core";
import { serializeDocToMarkdown } from "./serialize";
import type { TextSelection } from "./selection";

export function visualSelectionToMarkdownOffset(
  ed: Editor | null | undefined,
): TextSelection | null {
  if (!ed) return null;
  try {
    const { from, to } = ed.state.selection;
    const size = ed.state.doc.content.size;
    const full = serializeDocToMarkdown(ed.state.doc);
    const serializePrefix = (end: number) => {
      if (end <= 0) return "";
      const slice = ed.state.doc.slice(0, Math.min(end, size));
      if (slice.content.size === 0) return "";
      const partial = ed.state.doc.type.create(null, slice.content);
      return serializeDocToMarkdown(partial);
    };
    const fromOffset = Math.min(serializePrefix(from).length, full.length);
    const toOffset =
      to > from ? Math.min(serializePrefix(to).length, full.length) : fromOffset;
    return { from: fromOffset, to: Math.max(fromOffset, toOffset) };
  } catch {
    return null;
  }
}
