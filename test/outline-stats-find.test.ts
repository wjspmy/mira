import { describe, expect, it } from "vitest";
import { extractOutline } from "../src/editor/outline";
import { countDocumentStats, formatStatsLabel } from "../src/editor/stats";
import { findMatches, nextMatchIndex, replaceAllMatches } from "../src/editor/find-replace";

describe("extractOutline", () => {
  it("collects ATX headings and ignores fenced code", () => {
    const md = "# A\n\ntext\n\n## B\n\n```md\n# not heading\n```\n\n### C\n";
    const items = extractOutline(md);
    expect(items.map((i) => `${i.level}:${i.text}`)).toEqual(["1:A", "2:B", "3:C"]);
  });
});

describe("document stats", () => {
  it("counts CJK characters and latin words", () => {
    const stats = countDocumentStats("你好 world 世界");
    expect(stats.words).toBe(5); // 你 好 世 界 + world
    expect(formatStatsLabel(stats)).toContain("字");
  });
});

describe("find-replace", () => {
  it("finds literal matches and replaces all", () => {
    const text = "foo bar foo";
    expect(findMatches(text, "foo").length).toBe(2);
    const result = replaceAllMatches(text, "foo", "baz");
    expect(result).toEqual({ text: "baz bar baz", count: 2 });
  });

  it("supports regex and cycles indices", () => {
    expect(findMatches("a1 b2 c3", "\\d", { useRegex: true }).length).toBe(3);
    expect(nextMatchIndex(0, 3, 1)).toBe(1);
    expect(nextMatchIndex(2, 3, 1)).toBe(0);
  });
});
