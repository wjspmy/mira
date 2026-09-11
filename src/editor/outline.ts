export interface OutlineItem {
  level: number;
  text: string;
  /** Markdown 中的字符偏移（供源码模式定位） */
  offset: number;
  /** 1-based 行号 */
  line: number;
}

/** 从 Markdown 抽取 ATX 标题大纲（# ~ ######），忽略代码块内 #。 */
export function extractOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  if (!markdown) return items;
  let offset = 0;
  let line = 1;
  let inFence = false;
  let fenceMarker = "";

  for (const raw of markdown.split(/(?<=\n)/)) {
    const text = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
    const trimmed = text.trimStart();

    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      if (!inFence) {
        inFence = true;
        fenceMarker = trimmed.slice(0, 3);
      } else if (trimmed.startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = "";
      }
      offset += raw.length;
      line++;
      continue;
    }

    if (!inFence) {
      const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(text);
      if (match) {
        items.push({
          level: match[1].length,
          text: match[2].trim(),
          offset,
          line,
        });
      }
    }

    offset += raw.length;
    line++;
  }

  return items;
}
