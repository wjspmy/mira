export const CUSTOM_CSS_STYLE_ID = "mira-custom-editor-css";

const EDITOR_SCOPES = [".editor .ProseMirror", ".source-editor"];
const GLOBAL_SELECTOR_RE = /^(:root|html|body)(\b|\s|\.|#|\[|:)/i;

function scopeSelector(selector: string): string {
  const trimmed = selector.trim();
  if (!trimmed || trimmed.startsWith("@") || GLOBAL_SELECTOR_RE.test(trimmed)) return trimmed;
  if (EDITOR_SCOPES.some((scope) => trimmed.startsWith(scope))) return trimmed;
  return EDITOR_SCOPES.map((scope) => `${scope} ${trimmed}`).join(", ");
}

function splitSelectors(selectorText: string): string[] {
  const selectors: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;
  for (const char of selectorText) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(" || char === "[") depth++;
    if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      selectors.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) selectors.push(current);
  return selectors;
}

export function scopedEditorCss(css: string): string {
  let output = "";
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) {
      output += css.slice(i);
      break;
    }

    const selector = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }

    const body = css.slice(open + 1, j - 1).trim();
    if (selector.startsWith("@") && body.includes("{")) {
      output += `${selector} { ${scopedEditorCss(body)} }`;
    } else {
      const scoped = splitSelectors(selector).map(scopeSelector).join(", ");
      output += `${scoped} { ${body} }`;
    }
    i = j;
    if (i < css.length) output += "\n";
  }
  return output.trim();
}

export function upsertCustomCss(css: string) {
  clearCustomCss();
  if (!css.trim()) return;
  const style = document.createElement("style");
  style.id = CUSTOM_CSS_STYLE_ID;
  style.textContent = scopedEditorCss(css);
  document.head.appendChild(style);
}

export function clearCustomCss() {
  document.getElementById(CUSTOM_CSS_STYLE_ID)?.remove();
}
