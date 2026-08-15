import { describe, expect, it } from "vitest";
import { basename, dirname, isSameOrChildPath, joinPath, normPath, normalizeNativePath, replacePathPrefix } from "../src/utils/path";

describe("path utils", () => {
  it("normalizes Windows extended-length paths", () => {
    expect(normalizeNativePath("\\\\?\\C:\\Users\\me\\note.md")).toBe("C:\\Users\\me\\note.md");
    expect(normalizeNativePath("\\\\?\\UNC\\server\\share\\note.md")).toBe("\\\\server\\share\\note.md");
  });

  it("normalizes paths for case-insensitive comparisons", () => {
    expect(normPath("C:\\Users\\Me\\Docs\\")).toBe("c:/users/me/docs");
    expect(normPath("\\\\?\\C:\\Users\\Me\\Docs")).toBe("c:/users/me/docs");
  });

  it("detects same-or-child paths without prefix false positives", () => {
    expect(isSameOrChildPath("C:\\root\\child.md", "C:\\root")).toBe(true);
    expect(isSameOrChildPath("C:\\root", "C:\\root")).toBe(true);
    expect(isSameOrChildPath("C:\\rooted\\child.md", "C:\\root")).toBe(false);
  });

  it("replaces path prefixes while preserving the child suffix", () => {
    expect(replacePathPrefix("C:\\old\\dir\\file.md", "C:\\old", "D:\\new")).toBe("D:\\new\\dir\\file.md");
    expect(replacePathPrefix("C:/old/dir/file.md", "C:/old", "D:/new/")).toBe("D:/new/dir/file.md");
    expect(replacePathPrefix("C:\\other\\file.md", "C:\\old", "D:\\new")).toBe("C:\\other\\file.md");
  });

  it("handles basic name and parent helpers", () => {
    expect(basename("C:\\root\\note.md")).toBe("note.md");
    expect(dirname("C:\\root\\note.md")).toBe("C:\\root");
    expect(joinPath("C:\\root\\", "note.md")).toBe("C:\\root\\note.md");
    expect(joinPath("/tmp/root/", "note.md")).toBe("/tmp/root/note.md");
  });
});
