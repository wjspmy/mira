import { describe, expect, it } from "vitest";
import { buildAppMenuGroups } from "../src/menus/appMenu";

const shortcuts = {
  newDoc: "Ctrl + N",
  openFile: "Ctrl + O",
  openFolder: "Ctrl + Shift + O",
  saveFile: "Ctrl + S",
  closeTab: "Ctrl + W",
  toggleBold: "Ctrl + B",
  openShortcutSettings: "Ctrl + ,",
};

describe("app menu model", () => {
  it("places recent files under the file menu", () => {
    const groups = buildAppMenuGroups({
      recentPaths: ["C:/notes/a.md", "C:/notes/b.md"],
      shortcuts,
      hasActiveDoc: true,
      hasOpenTabs: true,
    });

    const file = groups.find((group) => group.id === "file");
    expect(file?.items.map((item) => item.label)).toContain("最近打开");
    expect(file?.items.filter((item) => item.recentPath).map((item) => item.label)).toEqual(["a.md", "b.md"]);
  });

  it("disables document actions when no document is open", () => {
    const groups = buildAppMenuGroups({ recentPaths: [], shortcuts, hasActiveDoc: false, hasOpenTabs: false });
    const file = groups.find((group) => group.id === "file")!;
    expect(file.items.find((item) => item.id === "saveFile")?.disabled).toBe(true);
    expect(file.items.find((item) => item.id === "closeTab")?.disabled).toBe(true);

    const format = groups.find((group) => group.id === "format")!;
    expect(format.items.every((item) => item.disabled)).toBe(true);
  });
});
