// 工作区 store（设计 §15.1）：根目录 + 懒加载文件树 + 展开状态
import { defineStore } from "pinia";
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[] | null;
}

const IGNORE = ["node_modules", "target", ".git", "dist", ".vite"];

export const useWorkspaceStore = defineStore("workspace", () => {
  const rootPath = ref<string | null>(null);
  const rootName = ref("");
  // 每个目录路径 → 该目录一层的子项。null=未加载，[]=空目录，[...]=已加载
  const childrenMap = ref<Record<string, FileNode[] | null>>({});
  const expanded = ref<Set<string>>(new Set());

  async function loadDir(path: string) {
    if (path in childrenMap.value) return; // 已加载（含加载中标记）
    // 先标记为 null（加载中），避免重复请求
    childrenMap.value = { ...childrenMap.value, [path]: null };
    try {
      const list = await invoke<FileNode[]>("list_dir", { path, ignore: IGNORE });
      childrenMap.value = { ...childrenMap.value, [path]: list };
    } catch (e) {
      console.error("list_dir failed", e);
      childrenMap.value = { ...childrenMap.value, [path]: [] };
    }
  }

  async function setRoot(path: string) {
    // 切换根：停掉旧根监听
    if (rootPath.value && rootPath.value !== path) {
      try {
        await invoke("unwatch", { root: rootPath.value });
      } catch (e) {
        console.error("unwatch failed", e);
      }
    }
    rootPath.value = path;
    rootName.value = path.split(/[\\/]/).pop() || path;
    childrenMap.value = {};
    expanded.value = new Set();
    await loadDir(path);
    expanded.value = new Set([path]); // 默认展开根
    // 启动文件监听（设计 §16.5）
    try {
      await invoke("watch", { root: path });
    } catch (e) {
      console.error("watch failed", e);
    }
  }

  async function toggle(path: string) {
    const s = new Set(expanded.value);
    if (s.has(path)) {
      s.delete(path);
    } else {
      if (!(path in childrenMap.value)) await loadDir(path);
      s.add(path);
    }
    expanded.value = s;
  }

  function isExpanded(path: string) {
    return expanded.value.has(path);
  }

  function childrenOf(path: string): FileNode[] | null {
    return childrenMap.value[path] ?? null;
  }

  async function openFolder() {
    const selected = await openDialog({ directory: true, multiple: false });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : (selected as any).path;
    if (!path) return;
    await setRoot(path);
    return path;
  }

  return { rootPath, rootName, expanded, setRoot, loadDir, toggle, isExpanded, childrenOf, openFolder };
});
