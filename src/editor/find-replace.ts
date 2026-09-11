export interface FindMatch {
  index: number;
  length: number;
}

/** 在纯文本/Markdown 中收集全部匹配位置。 */
export function findMatches(
  text: string,
  query: string,
  options: { useRegex?: boolean; caseSensitive?: boolean } = {},
): FindMatch[] {
  if (!query) return [];
  const flags = options.caseSensitive ? "g" : "gi";
  let re: RegExp;
  try {
    re = options.useRegex ? new RegExp(query, flags) : new RegExp(escapeRegExp(query), flags);
  } catch {
    return [];
  }
  const matches: FindMatch[] = [];
  for (const match of text.matchAll(re)) {
    if (match.index === undefined) continue;
    matches.push({ index: match.index, length: match[0].length });
    if (matches.length > 5000) break;
  }
  return matches;
}

export function replaceAllMatches(
  text: string,
  query: string,
  replacement: string,
  options: { useRegex?: boolean; caseSensitive?: boolean } = {},
): { text: string; count: number } {
  const matches = findMatches(text, query, options);
  if (!matches.length) return { text, count: 0 };
  const flags = options.caseSensitive ? "g" : "gi";
  let re: RegExp;
  try {
    re = options.useRegex ? new RegExp(query, flags) : new RegExp(escapeRegExp(query), flags);
  } catch {
    return { text, count: 0 };
  }
  const next = text.replace(re, replacement);
  return { text: next, count: matches.length };
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function nextMatchIndex(current: number, total: number, delta: 1 | -1): number {
  if (!total) return -1;
  if (current < 0) return 0;
  return (current + delta + total) % total;
}
