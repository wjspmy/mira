// 最近打开的文件（设计 §15.1 / §16）：持久化到 localStorage，上限 20 条
import { defineStore } from "pinia";
import { ref } from "vue";

const RECENT_KEY = "mira-recent";
const MAX = 20;

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
    recentPaths.value = [path, ...recentPaths.value.filter((p) => p !== path)].slice(0, MAX);
    persist();
  }

  function removeRecent(path: string) {
    recentPaths.value = recentPaths.value.filter((p) => p !== path);
    persist();
  }

  return { recentPaths, addRecent, removeRecent };
});
