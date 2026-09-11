export function sanitizeExportFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned || "untitled";
}

export function withExtension(name: string, ext: string): string {
  const lower = name.toLowerCase();
  const suffix = ext.startsWith(".") ? ext : `.${ext}`;
  return lower.endsWith(suffix) ? name : name + suffix;
}
