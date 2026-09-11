import { describe, expect, it } from "vitest";
import { resolveExportImageSrc } from "../src/services/export-images";

describe("resolveExportImageSrc", () => {
  const docDir = String.raw`C:\notes\chapter`;

  it("resolves relative markdown image paths", () => {
    expect(resolveExportImageSrc("./assets/a.png", docDir)).toBe(String.raw`C:\notes\chapter\assets/a.png`);
    expect(resolveExportImageSrc("../img/b.jpg", docDir)).toBe(String.raw`C:\notes\chapter\../img/b.jpg`);
  });

  it("keeps absolute windows paths", () => {
    expect(resolveExportImageSrc(String.raw`D:\pic\x.png`, docDir)).toBe(String.raw`D:\pic\x.png`);
  });

  it("unwraps tauri asset urls", () => {
    expect(resolveExportImageSrc("asset://localhost/C:/notes/chapter/assets/a.png", docDir)).toBe(
      "C:/notes/chapter/assets/a.png",
    );
  });

  it("ignores remote and data urls", () => {
    expect(resolveExportImageSrc("https://example.com/a.png", docDir)).toBeNull();
    expect(resolveExportImageSrc("data:image/png;base64,xxx", docDir)).toBeNull();
    expect(resolveExportImageSrc("./a.png", null)).toBeNull();
  });
});
