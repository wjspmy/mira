import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { useRecentStore } from "../src/stores/recent";
import { useSessionStore } from "../src/stores/session";
import { useWorkspaceStore, type FileNode } from "../src/stores/workspace";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  lists: new Map<string, FileNode[]>(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mocks.open,
}));

function list(path: string, nodes: FileNode[]) {
  mocks.lists.set(path, nodes);
}

beforeEach(() => {
  localStorage.clear();
  mocks.lists.clear();
  mocks.open.mockReset();
  mocks.invoke.mockReset();
  mocks.invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
    if (command === "list_dir") return mocks.lists.get(String(args?.path)) ?? [];
    return null;
  });
  setActivePinia(createPinia());
});

describe("workspace store", () => {
  it("remaps loaded folder cache and refreshes touched dirs on external move", async () => {
    list("C:\\root", [
      { name: "docs", path: "C:\\root\\docs", isDir: true },
      { name: "other.md", path: "C:\\root\\other.md", isDir: false },
    ]);
    list("C:\\root\\docs", [
      { name: "a.md", path: "C:\\root\\docs\\a.md", isDir: false },
    ]);

    const ws = useWorkspaceStore();
    await ws.setRoot("\\\\?\\C:\\root");
    await ws.loadDir("C:\\root\\docs");
    expect(ws.childrenOf("C:\\root\\docs")?.[0]?.path).toBe("C:\\root\\docs\\a.md");

    list("C:\\root", [
      { name: "notes", path: "C:\\root\\notes", isDir: true },
      { name: "other.md", path: "C:\\root\\other.md", isDir: false },
    ]);
    list("C:\\root\\notes", [
      { name: "a.md", path: "C:\\root\\notes\\a.md", isDir: false },
    ]);

    await ws.syncExternalMove("C:\\root\\docs", "C:\\root\\notes");

    expect(ws.childrenOf("C:\\root\\docs")).toBeNull();
    expect(ws.childrenOf("C:\\root\\notes")?.[0]?.path).toBe("C:\\root\\notes\\a.md");
    expect(ws.childrenOf("C:\\root")?.map((n) => n.path)).toEqual(["C:\\root\\notes", "C:\\root\\other.md"]);
    expect(invoke).toHaveBeenCalledWith("allow_path", { path: "C:\\root" });
  });

  it("rejects moving a folder inside itself", async () => {
    list("C:\\root", [{ name: "docs", path: "C:\\root\\docs", isDir: true }]);
    const ws = useWorkspaceStore();
    await ws.setRoot("C:\\root");

    await expect(ws.moveNodeToDir({ name: "docs", path: "C:\\root\\docs", isDir: true }, "C:\\root\\docs\\inner"))
      .rejects.toThrow("不能将文件夹移动到自身内部");
    expect(invoke).not.toHaveBeenCalledWith("rename_path", expect.anything());
  });
});

describe("recent store", () => {
  it("renames recent paths under a moved folder and removes duplicates", () => {
    const recent = useRecentStore();
    recent.addRecent("C:\\root\\docs\\a.md");
    recent.addRecent("C:\\root\\notes\\a.md");
    recent.addRecent("C:\\root\\docs\\b.md");

    recent.renameRecent("C:\\root\\docs", "C:\\root\\notes");

    expect(recent.recentPaths).toEqual([
      "C:\\root\\notes\\b.md",
      "C:\\root\\notes\\a.md",
    ]);
  });

  it("removes recent entries at or under a path", () => {
    const recent = useRecentStore();
    recent.addRecent("C:\\root\\docs\\a.md");
    recent.addRecent("C:\\root\\docs");
    recent.addRecent("C:\\rooted\\docs\\b.md");

    recent.removeRecentUnder("C:\\root\\docs");

    expect(recent.recentPaths).toEqual(["C:\\rooted\\docs\\b.md"]);
  });
});

describe("session store", () => {
  it("finds and snapshots docs with normalized Windows paths", () => {
    const session = useSessionStore();
    session.addDoc({ id: "a", filePath: "\\\\?\\C:\\root\\A.md", rawMd: "a", dirty: false });
    session.addDoc({ id: "dup", filePath: "C:\\ROOT\\A.md", rawMd: "dup", dirty: false });
    session.addDoc({ id: "draft", filePath: null, rawMd: "draft", dirty: true });
    session.setActive("a");

    expect(session.findDocByPath("C:\\root\\a.md")?.id).toBe("a");
    expect(session.snapshot()).toEqual({ openPaths: ["C:\\root\\A.md"], activePath: "C:\\root\\A.md" });
  });

  it("loads persisted session snapshots with normalized paths", () => {
    localStorage.setItem("mira-session", JSON.stringify({
      openPaths: ["\\\\?\\C:\\root\\a.md", 123, "C:\\root\\b.md"],
      activePath: "\\\\?\\C:\\root\\b.md",
    }));

    const session = useSessionStore();

    expect(session.loadSnapshot()).toEqual({
      openPaths: ["C:\\root\\a.md", "C:\\root\\b.md"],
      activePath: "C:\\root\\b.md",
    });
  });
});
