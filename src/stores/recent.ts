// 最近打开的文件（设计 §15.1 / §16）：持久化到 localStorage，上限 20 条
import { defineStore } from "pinia";
import { ref } from "vue";

const RECENT_KEY = "mira-recent";
const MAX = 20;

function normPath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
}

export const useRecentStore = defineStore("recent", () => {
  const recentPaths = ref<string[]>(load());

  function load(): string[] {
    try {
      const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  function persist() {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentPaths.value));
  }

  function addRecent(path: string) {
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
    const oldNorm = normPath(oldPath);
    const newNorm = normPath(newPath);
    let replaced = false;
    const next: string[] = [];
    for (const p of recentPaths.value) {
      const np = normPath(p);
      if (np === oldNorm) {
        if (!next.some((x) => normPath(x) === newNorm)) next.push(newPath);
        replaced = true;
      } else if (np !== newNorm) {
        next.push(p);
      }
    }
    if (replaced) {
      recentPaths.value = next.slice(0, MAX);
      persist();
    }
  }

  return { recentPaths, addRecent, removeRecent, renameRecent };
});
