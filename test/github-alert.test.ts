import { describe, expect, it } from "vitest";
import { buildAlertBlockquote, detectGithubAlert } from "../src/editor/toolbar";

describe("github alerts helpers", () => {
  it("detects alert markers", () => {
    expect(detectGithubAlert("[!NOTE]")).toBe("NOTE");
    expect(detectGithubAlert("[!warning]")).toBe("WARNING");
    expect(detectGithubAlert("normal text")).toBeNull();
    expect(detectGithubAlert("[!FOO]")).toBeNull();
  });

  it("builds alert markdown", () => {
    expect(buildAlertBlockquote("NOTE", "hi")).toBe("> [!NOTE]\n> hi\n");
  });
});
