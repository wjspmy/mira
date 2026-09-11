import { describe, expect, it } from "vitest";
import { sanitizeExportFileName, withExtension } from "../src/services/export-name";
import { escapeHtml, wrapStandaloneHtml } from "../src/services/export";

describe("export file naming", () => {
  it("sanitizes illegal characters", () => {
    expect(sanitizeExportFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
    expect(sanitizeExportFileName("   ")).toBe("untitled");
  });

  it("appends extension only once", () => {
    expect(withExtension("note", ".html")).toBe("note.html");
    expect(withExtension("note.HTML", ".html")).toBe("note.HTML");
  });
});

describe("standalone html export", () => {
  it("escapes title and embeds fragment", () => {
    const html = wrapStandaloneHtml("<p>hi</p>", { title: `A <B> "C"`, theme: "dark" });
    expect(html).toContain("<title>A &lt;B&gt; &quot;C&quot;</title>");
    expect(html).toContain("<article class=\"mira-export\">\n<p>hi</p>");
    expect(html).toContain("background: #0d1117");
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });
});
