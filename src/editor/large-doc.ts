export const LARGE_DOC_THRESHOLD_BYTES = 200 * 1024;
/** 超过该大小关闭 Markdown 语法高亮等重扩展，只保留虚拟滚动源码编辑（对标 VS Code 大文件降级）。 */
export const HUGE_DOC_THRESHOLD_BYTES = 1024 * 1024;

export function isLargeDocument(markdown: string): boolean {
  return markdown.length >= LARGE_DOC_THRESHOLD_BYTES;
}

export function isHugeDocument(markdown: string): boolean {
  return markdown.length >= HUGE_DOC_THRESHOLD_BYTES;
}

export function formatDocSizeLabel(markdown: string): string {
  const kb = markdown.length / 1024;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.round(kb)} KB`;
}
