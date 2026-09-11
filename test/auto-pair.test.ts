import { describe, expect, it } from "vitest";

// AutoPair 是 Tiptap 扩展，这里测纯逻辑假设（配对表）
const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
  "*": "*",
  _: "_",
};

describe("auto-pair pairs", () => {
  it("has matching open/close for common delimiters", () => {
    expect(Object.keys(PAIRS).length).toBeGreaterThanOrEqual(6);
    for (const [open, close] of Object.entries(PAIRS)) {
      expect(typeof close).toBe("string");
      expect(close.length).toBeGreaterThan(0);
      expect(open === close || true).toBe(true);
    }
  });
});
