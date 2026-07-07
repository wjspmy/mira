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
const WORKSPACE_ROOT_KEY = "mira-workspace-root";

function normPath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
}

function parentDir(path: string): string {
  const sep = path.includes("\\") ? "\\" : "/";
  return path.lastIndexOf(sep) >= 0 ? path.slice(0, path.lastIndexOf(sep)) : "";
}

function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return dir.replace(/[\\/]+$/, "") + sep + name;
}

function normalizeFileName(name: string): string {
  const n = validateName(name);
  return n.includes(".") ? n : `${n}.md`;
}

function validateName(name: string): string {
  const n = name.trim();
  if (!n) throw new Error("名称不能为空");
  if (/[\\/]/.test(n)) throw new Error("名称不能包含路径分隔符");
  if (/[<>:"|?*]/.test(n)) throw new Error("名称包含非法字符");
  return n;
}

const IGNORED_SEGMENTS = new Set(IGNORE);

function isIgnoredPath(path: string): boolean {
  return path.replace(/\\/g, "/").split("/").some((seg) => IGNORED_SEGMENTS.has(seg));
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const rootPath = ref<string | null>(null);
  const rootName = ref("");
  // 每个目录路径 → 该目录一层的子项。null=未加载，[]=空目录，[...]=已加载
  const childrenMap = ref<Record<string, FileNode[] | null>>({});
  const expanded = ref<Set<string>>(new Set());

  async function loadDir(path: string) {
    if (path in childrenMap.value) return; // 已加载（含加载中标记）
    await refreshDir(path);
  }

  async function refreshDir(path: string) {
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
    localStorage.setItem(WORKSPACE_ROOT_KEY, path);
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

  function isUnderRoot(path: string) {
    if (!rootPath.value) return false;
    const root = normPath(rootPath.value);
    const target = normPath(path);
    return target === root || target.startsWith(root + "/");
  }

  async function refreshForPath(path: string) {
    if (!rootPath.value || !isUnderRoot(path) || isIgnoredPath(path)) return;
    const dirs = new Set<string>();
    const root = rootPath.value;
    const parent = parentDir(path);
    if (normPath(path) === normPath(root)) dirs.add(root);
    // 只刷新已经加载过的目录，避免未展开目录因后台事件触发大量 IO/渲染。
    if (parent && parent in childrenMap.value) dirs.add(parent);
    if (path in childrenMap.value) dirs.add(path);
    for (const dir of dirs) {
      await refreshDir(dir);
    }
  }

  async function createFileInRoot(name: string): Promise<string> {
    if (!rootPath.value) throw new Error("请先打开文件夹");
    const fileName = normalizeFileName(name);
    const path = joinPath(rootPath.value, fileName);
    await invoke("create_text_file", { path });
    await refreshDir(rootPath.value);
    return path;
  }

  async function createFolderInRoot(name: string): Promise<string> {
    if (!rootPath.value) throw new Error("请先打开文件夹");
    const folderName = validateName(name);
    const path = joinPath(rootPath.value, folderName);
    await invoke("create_dir", { path });
    await refreshDir(rootPath.value);
    return path;
  }

  async function openFolder() {
    const selected = await openDialog({ directory: true, multiple: false });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : (selected as any).path;
    if (!path) return;
    await setRoot(path);
    return path;
  }

  function savedRoot() {
    return localStorage.getItem(WORKSPACE_ROOT_KEY);
  }

  function clearSavedRoot() {
    localStorage.removeItem(WORKSPACE_ROOT_KEY);
  }

  return { rootPath, rootName, expanded, setRoot, loadDir, refreshDir, refreshForPath, createFileInRoot, createFolderInRoot, toggle, isExpanded, childrenOf, openFolder, savedRoot, clearSavedRoot };
});
