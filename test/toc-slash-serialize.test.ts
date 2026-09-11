import { describe, expect, it } from "vitest";
import { buildTocMarkdown, slugifyHeading } from "../src/editor/toc";
import { filterSlashCommands } from "../src/editor/slash";

describe("toc", () => {
  it("builds indented toc from headings", () => {
    const md = "# A\n\n## B\n\n### C\n\ntext\n";
    const toc = buildTocMarkdown(md, 3);
    expect(toc).toContain("## 目录");
    expect(toc).toContain("- [A](#a)");
    expect(toc).toContain("  - [B](#b)");
    expect(slugifyHeading("Hello World!")).toBe("hello-world");
  });
});

describe("slash filter", () => {
  it("filters by label and keywords", () => {
    expect(filterSlashCommands("表格").length).toBeGreaterThan(0);
    expect(filterSlashCommands("mermaid").some((c) => c.id === "insertMermaid")).toBe(true);
    expect(filterSlashCommands("").length).toBeGreaterThan(10);
  });
});
