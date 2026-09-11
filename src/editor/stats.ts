export interface DocumentStats {
  /** 中英混合字数：CJK 按字，拉丁按词 */
  words: number;
  characters: number;
  /** 不含空白字符 */
  charactersNoSpaces: number;
}

export function countDocumentStats(markdown: string): DocumentStats {
  const text = markdown || "";
  const cjk = text.match(/[一-鿿㐀-䶿぀-ヿ가-힯]/g)?.length ?? 0;
  const latinWords = text
    .replace(/[一-鿿㐀-䶿぀-ヿ가-힯]/g, " ")
    .match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0;
  return {
    words: cjk + latinWords,
    characters: [...text].length,
    charactersNoSpaces: text.replace(/\s+/g, "").length,
  };
}

export function formatStatsLabel(stats: DocumentStats): string {
  return `${stats.words} 字 · ${stats.charactersNoSpaces} 字符`;
}
