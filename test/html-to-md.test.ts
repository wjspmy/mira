import { describe, expect, it } from "vitest";
import { htmlClipboardToMarkdown } from "../src/editor/html-to-md";

describe("htmlClipboardToMarkdown", () => {
  it("converts headings, lists, emphasis", () => {
    const md = htmlClipboardToMarkdown(
      "<h1>Title</h1><p>Hello <strong>bold</strong> and <em>it</em>.</p><ul><li>a</li><li>b</li></ul>",
    );
    expect(md).toBeTruthy();
    expect(md).toContain("# Title");
    expect(md).toContain("**bold**");
    expect(md).toContain("*it*");
    expect(md).toContain("- a");
  });

  it("converts links and blockquote", () => {
    const md = htmlClipboardToMarkdown(
      '<p><a href="https://example.com">link</a></p><blockquote><p>quote</p></blockquote>',
    );
    expect(md).toContain("[link](https://example.com)");
    expect(md).toContain("> quote");
  });

  it("returns null for non-html or empty", () => {
    expect(htmlClipboardToMarkdown("just text")).toBeNull();
    expect(htmlClipboardToMarkdown("")).toBeNull();
  });

  it("strips browser wrapper, style and script", () => {
    const md = htmlClipboardToMarkdown(
      `<html><head><style>p{color:red}</style></head><body><!--StartFragment--><p>Hello <span style="color:red">world</span></p><!--EndFragment--></body></html>`,
    );
    expect(md).toBeTruthy();
    expect(md).toContain("Hello world");
    expect(md).not.toContain("color:red");
    expect(md).not.toContain("StartFragment");
  });

  it("converts tables and code blocks", () => {
    const md = htmlClipboardToMarkdown(
      `<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><pre><code class="language-js">x=1</code></pre>`,
    );
    expect(md).toContain("| A | B |");
    expect(md).toContain("```js");
    expect(md).toContain("x=1");
  });
});

