// 最近打开的文件（设计 §15.1 / §16）：持久化到 localStorage，上限 20 条
import { defineStore } from "pinia";
import { ref } from "vue";
import { normalizeNativePath, normPath, replacePathPrefix } from "../utils/path";

const RECENT_KEY = "mira-recent";
const MAX = 20;

export const useRecentStore = defineStore("recent", () => {
  const recentPaths = ref<string[]>(load());

  function load(): string[] {
    try {
      const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").map(normalizeNativePath) : [];
    } catch {
      return [];
    }
  }

  function persist() {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentPaths.value));
  }

  function addRecent(path: string) {
    path = normalizeNativePath(path);
    const np = normPath(path);
    recentPaths.value = [path, ...recentPaths.value.filter((p) => normPath(p) !== np)].slice(0, MAX);
    persist();
  }

  function removeRecent(path: string) {
    const np = normPath(path);
    recentPaths.value = recentPaths.value.filter((p) => normPath(p) !== np);
    persist();
  }

  function renameRecent(oldPath: string, newPath: string) {
    let replaced = false;
    const next: string[] = [];
    for (const p of recentPaths.value) {
      const nextPath = replacePathPrefix(p, oldPath, newPath);
      const nextNorm = normPath(nextPath);
      if (nextNorm !== normPath(p)) replaced = true;
      if (!next.some((x) => normPath(x) === nextNorm)) next.push(nextPath);
    }
    if (replaced) {
      recentPaths.value = next.slice(0, MAX);
      persist();
    }
  }

  function removeRecentUnder(path: string) {
    const root = normPath(path);
    recentPaths.value = recentPaths.value.filter((p) => {
      const np = normPath(p);
      return np !== root && !np.startsWith(root + "/");
    });
    persist();
  }

  return { recentPaths, addRecent, removeRecent, renameRecent, removeRecentUnder };
});
