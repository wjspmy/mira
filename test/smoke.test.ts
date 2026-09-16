import { describe, expect, it } from "vitest";
import { SMOKE_CHECKLIST, formatSmokeReport } from "./smoke-checklist";

describe("smoke checklist", () => {
  it("covers core release paths", () => {
    const ids = SMOKE_CHECKLIST.map((s) => s.id);
    expect(ids).toContain("open-file");
    expect(ids).toContain("export-html");
    expect(ids).toContain("find-replace");
    expect(SMOKE_CHECKLIST.every((s) => s.action && s.expect)).toBe(true);
  });

  it("formats report", () => {
    expect(formatSmokeReport(["a", "b"], ["c"])).toContain("FAIL: c");
  });
});
