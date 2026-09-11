/** YAML Front Matter 辅助（只读展示 + 一键模板；完整解析可后续加强） */
export function hasFrontMatter(markdown: string): boolean {
  return /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.test(markdown);
}

export function extractFrontMatter(markdown: string): string | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  return m ? m[1] : null;
}

export function buildFrontMatterTemplate(title: string): string {
  const safe = title.replace(/"/g, '\\"');
  return `---\ntitle: "${safe}"\ndate: ${new Date().toISOString().slice(0, 10)}\ntags: []\n---\n\n`;
}
