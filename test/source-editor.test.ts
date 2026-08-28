import { describe, expect, it } from "vitest";
import { createSourceEditorState, sourceDocumentChange } from "../src/editor/source-editor";

describe("source editor", () => {
  it("keeps the initial Markdown document unchanged", () => {
    const markdown = "# Title\n\n- one\n- two\n";
    const state = createSourceEditorState(markdown);
    expect(state.doc.toString()).toBe(markdown);
  });

  it("creates a full-document change only when text changes", () => {
    expect(sourceDocumentChange("same", "same")).toBeNull();
    expect(sourceDocumentChange("old", "new")).toEqual({ from: 0, to: 3, insert: "new" });
  });
});
