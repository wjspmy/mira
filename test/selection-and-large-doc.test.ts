import { describe, expect, it } from "vitest";
import { clampTextSelection } from "../src/editor/selection";
import {
  formatDocSizeLabel,
  isHugeDocument,
  isLargeDocument,
  HUGE_DOC_THRESHOLD_BYTES,
  LARGE_DOC_THRESHOLD_BYTES,
} from "../src/editor/large-doc";
import { createSourceEditorState } from "../src/editor/source-editor";

describe("clampTextSelection", () => {
  it("returns null when selection is missing", () => {
    expect(clampTextSelection(10, null)).toBeNull();
    expect(clampTextSelection(10, undefined)).toBeNull();
  });

  it("clamps offsets into the document range", () => {
    expect(clampTextSelection(10, { from: -5, to: 99 })).toEqual({ from: 0, to: 10 });
    expect(clampTextSelection(10, { from: 4, to: 2 })).toEqual({ from: 4, to: 4 });
    expect(clampTextSelection(0, { from: 3, to: 7 })).toEqual({ from: 0, to: 0 });
  });
});

describe("large document thresholds", () => {
  it("flags documents at or above 200KB as large", () => {
    expect(isLargeDocument("a".repeat(LARGE_DOC_THRESHOLD_BYTES - 1))).toBe(false);
    expect(isLargeDocument("a".repeat(LARGE_DOC_THRESHOLD_BYTES))).toBe(true);
  });

  it("flags documents at or above 1MB as huge", () => {
    expect(isHugeDocument("a".repeat(HUGE_DOC_THRESHOLD_BYTES - 1))).toBe(false);
    expect(isHugeDocument("a".repeat(HUGE_DOC_THRESHOLD_BYTES))).toBe(true);
  });

  it("formats size labels", () => {
    expect(formatDocSizeLabel("a".repeat(1024))).toBe("1 KB");
    expect(formatDocSizeLabel("a".repeat(2048))).toBe("2 KB");
  });
});

describe("source editor plain mode", () => {
  it("creates a plain state that keeps full document text", () => {
    const md = "# title\n\nhello\n";
    const state = createSourceEditorState(md, {}, { plain: true });
    expect(state.doc.toString()).toBe(md);
  });
});
