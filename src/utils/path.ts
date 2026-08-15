export function normalizeNativePath(path: string): string {
  const uncPrefix = "\\\\?\\UNC\\";
  const localPrefix = "\\\\?\\";
  if (path.startsWith(uncPrefix)) return "\\\\" + path.slice(uncPrefix.length);
  if (path.startsWith(localPrefix)) return path.slice(localPrefix.length);
  return path;
}

export function normPath(path: string): string {
  return normalizeNativePath(path).replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
}

export function basename(path: string): string {
  const normalized = normalizeNativePath(path).replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] || normalized;
}

export function dirname(path: string): string {
  const normalized = normalizeNativePath(path).replace(/[\\/]+$/, "");
  const slash = normalized.lastIndexOf("/");
  const backslash = normalized.lastIndexOf("\\");
  const idx = Math.max(slash, backslash);
  return idx >= 0 ? normalized.slice(0, idx) : "";
}

export function joinPath(dir: string, name: string): string {
  const normalizedDir = normalizeNativePath(dir);
  const sep = normalizedDir.includes("\\") ? "\\" : "/";
  return normalizedDir.replace(/[\\/]+$/, "") + sep + name;
}

export function isSameOrChildPath(path: string, root: string): boolean {
  const p = normPath(path);
  const r = normPath(root);
  return p === r || p.startsWith(r + "/");
}

export function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  if (!isSameOrChildPath(path, oldPrefix)) return path;
  const normalizedPath = normalizeNativePath(path);
  const normalizedOld = normalizeNativePath(oldPrefix).replace(/[\\/]+$/, "");
  const normalizedNew = normalizeNativePath(newPrefix).replace(/[\\/]+$/, "");
  if (normPath(normalizedPath) === normPath(normalizedOld)) return normalizedNew;
  const suffix = normalizedPath.slice(normalizedOld.length);
  return normalizedNew + suffix;
}
