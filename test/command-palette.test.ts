import { describe, expect, it } from "vitest";
import { buildPaletteEntries, searchPaletteEntries } from "../src/command-palette/model";

const commands = [
  { id: "saveFile", title: "保存当前文档", group: "file", defaultShortcut: "Mod+S" },
  { id: "openFile", title: "打开文件", group: "file", defaultShortcut: "Mod+O" },
  { id: "openCommandPalette", title: "打开命令面板", group: "app", defaultShortcut: "Mod+Shift+P" },
] as const;

describe("command palette model", () => {
  it("puts command matches before file matches and hides the palette command itself", () => {
    const entries = buildPaletteEntries({
      commands: [...commands],
      shortcuts: { saveFile: "Ctrl + S" },
      openPaths: ["C:/notes/save.md"],
      recentPaths: [],
      workspacePaths: [],
    });
    const results = searchPaletteEntries(entries, "save");

    expect(results[0]).toMatchObject({ kind: "command", commandId: "saveFile" });
    expect(results.some((entry) => entry.commandId === "openCommandPalette")).toBe(false);
  });

  it("deduplicates file paths and matches names plus path fragments", () => {
    const entries = buildPaletteEntries({
      commands: [],
      shortcuts: {},
      openPaths: ["C:/project/docs/guide.md"],
      recentPaths: ["C:/project/docs/guide.md"],
      workspacePaths: ["C:/project/docs/guide.md", "C:/project/notes/todo.md"],
    });

    expect(entries.filter((entry) => entry.kind === "file")).toHaveLength(2);
    expect(searchPaletteEntries(entries, "guide")[0]).toMatchObject({ path: "C:/project/docs/guide.md" });
    expect(searchPaletteEntries(entries, "notes/todo")[0]).toMatchObject({ path: "C:/project/notes/todo.md" });
  });
});
