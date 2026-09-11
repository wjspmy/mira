import { describe, expect, it } from "vitest";
import { buildFrontMatterTemplate, extractFrontMatter, hasFrontMatter } from "../src/editor/front-matter";

describe("front matter", () => {
  it("detects and extracts yaml front matter", () => {
    const md = "---\ntitle: demo\n---\n\n# Hi\n";
    expect(hasFrontMatter(md)).toBe(true);
    expect(extractFrontMatter(md)).toContain("title: demo");
    expect(hasFrontMatter("# no\n")).toBe(false);
  });

  it("builds template", () => {
    const t = buildFrontMatterTemplate("My Doc");
    expect(t.startsWith("---\n")).toBe(true);
    expect(t).toContain("title: \"My Doc\"");
  });
});
