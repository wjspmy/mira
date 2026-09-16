/** 将粘贴的 HTML 片段转为 Markdown（MarkText / Toast 风格） */

function convertInline(el: Element): string {
  let out = "";
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent || "";
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const node = child as Element;
    const tag = node.tagName.toLowerCase();
    // 浏览器/Office 噪音
    if (tag === "script" || tag === "style" || tag === "meta" || tag === "link" || tag === "title") continue;
    if (tag === "span" || tag === "font" || tag === "u" || tag === "ins") {
      out += convertInline(node);
      continue;
    }
    const inner = convertInline(node);
    if (!inner.trim() && tag !== "br" && tag !== "img") {
      out += inner;
      continue;
    }
    switch (tag) {
      case "br":
        out += "\n";
        break;
      case "strong":
      case "b":
        out += `**${inner}**`;
        break;
      case "em":
      case "i":
        out += `*${inner}*`;
        break;
      case "del":
      case "s":
      case "strike":
        out += `~~${inner}~~`;
        break;
      case "code":
        out += `\`${inner}\``;
        break;
      case "mark":
        out += `==${inner}==`;
        break;
      case "sub":
        out += `~${inner}~`;
        break;
      case "sup":
        out += `^${inner}^`;
        break;
      case "a": {
        const href = node.getAttribute("href") || "";
        if (!href) out += inner;
        else out += `[${inner || href}](${href})`;
        break;
      }
      case "img": {
        const src = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "";
        if (src) out += `![${alt}](${src})`;
        break;
      }
      case "input": {
        if (node.getAttribute("type") === "checkbox") {
          out += node.hasAttribute("checked") ? "[x]" : "[ ]";
        }
        break;
      }
      default:
        out += inner;
    }
  }
  return out;
}

function convertBlock(el: Element, depth = 0): string {
  const tag = el.tagName.toLowerCase();
  const indent = "  ".repeat(depth);

  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = Number(tag[1]);
      return `${"#".repeat(level)} ${convertInline(el).trim()}\n\n`;
    }
    case "p":
      return `${convertInline(el).trim()}\n\n`;
    case "blockquote": {
      const inner = Array.from(el.childNodes)
        .map((n) => (n.nodeType === Node.ELEMENT_NODE ? convertBlock(n as Element, 0) : convertInline(el)))
        .join("");
      const body = inner.trim();
      if (!body) return "";
      return (
        body
          .split("\n")
          .map((line) => (line ? `> ${line}` : ">"))
          .join("\n") + "\n\n"
      );
    }
    case "pre": {
      const code = el.querySelector("code");
      const lang = (code?.className || "").match(/language-([\w+-]+)/)?.[1] || "";
      const body = (code?.textContent ?? el.textContent ?? "").replace(/\n$/, "");
      return `\`\`\`${lang}\n${body}\n\`\`\`\n\n`;
    }
    case "ul":
    case "ol": {
      let i = 1;
      let out = "";
      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() !== "li") continue;
        const checkbox = li.querySelector('input[type="checkbox"]');
        const marker = tag === "ol" ? `${i++}. ` : checkbox ? "- " : "- ";
        const check = checkbox ? (checkbox.hasAttribute("checked") ? "[x] " : "[ ] ") : "";
        const clone = li.cloneNode(true) as Element;
        clone.querySelectorAll("ul,ol").forEach((n) => n.remove());
        const text = convertInline(clone).trim();
        out += `${indent}${marker}${check}${text}\n`;
        for (const child of Array.from(li.children)) {
          const ctag = child.tagName.toLowerCase();
          if (ctag === "ul" || ctag === "ol") out += convertBlock(child, depth + 1);
        }
      }
      return out ? out + "\n" : "";
    }
    case "hr":
      return "---\n\n";
    case "table": {
      const rows = Array.from(el.querySelectorAll("tr"));
      if (!rows.length) return "";
      const matrix = rows.map((tr) =>
        Array.from(tr.querySelectorAll("th,td")).map((cell) =>
          convertInline(cell).replace(/\|/g, "\\|").replace(/\n/g, " ").trim(),
        ),
      );
      const cols = Math.max(...matrix.map((r) => r.length));
      const norm = matrix.map((r) => {
        const row = [...r];
        while (row.length < cols) row.push("");
        return row;
      });
      const header = norm[0];
      const sep = header.map(() => "---");
      const body = norm.slice(1);
      const lines = [
        `| ${header.join(" | ")} |`,
        `| ${sep.join(" | ")} |`,
        ...body.map((r) => `| ${r.join(" | ")} |`),
      ];
      return lines.join("\n") + "\n\n";
    }
    case "div":
    case "section":
    case "article":
    case "body":
    case "main":
    case "header":
    case "footer":
    case "nav":
    case "aside": {
      let out = "";
      for (const child of Array.from(el.children)) out += convertBlock(child, depth);
      // 仅在无块级子节点时，把散落行内内容当段落
      if (!out.trim()) {
        const leftover = convertInline(el).trim();
        return leftover ? `${leftover}\n\n` : "";
      }
      return out;
    }
    default: {
      const inline = convertInline(el).trim();
      if (!inline) return "";
      return `${inline}\n\n`;
    }
  }
}

/** clipboard HTML → Markdown 文本；非 HTML 或转换失败返回 null */
export function htmlClipboardToMarkdown(html: string): string | null {
  if (!html || typeof document === "undefined") return null;
  if (!/<[a-z][\s\S]*>/i.test(html)) return null;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,meta,link,title,xml").forEach((n) => n.remove());
    const root = doc.body;
    if (!root) return null;
    let md = convertBlock(root);
    md = md
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!md) return null;
    // 仅在「几乎纯文本、无块级标签」时交给默认粘贴
    const textOnly = (root.textContent || "").replace(/\s+/g, " ").trim();
    const mdFlat = md.replace(/\s+/g, " ").trim();
    const hasBlockTags = /<(p|h[1-6]|ul|ol|li|blockquote|pre|table|div|section|article)\b/i.test(html);
    if (!hasBlockTags && textOnly && mdFlat === textOnly) return null;
    return md + "\n";
  } catch {
    return null;
  }
}
