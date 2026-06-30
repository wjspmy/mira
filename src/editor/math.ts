// KaTeX 数学公式支持：行内 $...$ 与块级 $$...$$
// - markdown-it 插件把公式解析为带 data-latex 的占位元素
// - MathInline（行内，只渲染）/ MathBlock（块级，点击编辑原文）
// - tiptap-markdown serialize glue 保证 round-trip（保存回 $...$ / $$...$$）
import { Node } from "@tiptap/core";
import katex from "katex";

/* eslint-disable */
function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// markdown-it 数学解析插件（已在 node 里验证：行内 + 多行块正确）
export function mathPlugin(md: any) {
  // 行内 $...$
  md.inline.ruler.before("escape", "math_inline", (state: any, silent: boolean) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x24) return false;
    if (state.src.charCodeAt(start + 1) === 0x24) return false; // $$ 交给 block
    let pos = start + 1;
    while (pos < state.posMax) {
      const c = state.src.charCodeAt(pos);
      if (c === 0x5c) { pos += 2; continue; }
      if (c === 0x24 && state.src.charCodeAt(pos + 1) !== 0x24) break;
      pos++;
    }
    if (pos >= state.posMax) return false;
    const content = state.src.slice(start + 1, pos);
    if (!content || content.includes("\n")) return false;
    if (!silent) {
      const t = state.push("math_inline", "span", 0);
      t.markup = "$";
      t.content = content;
    }
    state.pos = pos + 1;
    return true;
  });
  md.renderer.rules.math_inline = (tokens: any[], idx: number) =>
    `<span class="math-inline" data-latex="${escapeAttr(tokens[idx].content)}"></span>`;

  // 块级 $$...$$
  md.block.ruler.before("fence", "math_block", (state: any, startLine: number, endLine: number, silent: boolean) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    if (start + 1 >= max) return false;
    if (state.src.charCodeAt(start) !== 0x24 || state.src.charCodeAt(start + 1) !== 0x24) return false;
    if (silent) return true;
    const firstRest = state.src.slice(start + 2, max);
    if (firstRest.trimEnd().endsWith("$$")) {
      const c = firstRest.trimEnd().slice(0, -2).trim();
      const t = state.push("math_block", "div", 0);
      t.block = true; t.markup = "$$"; t.content = c; t.map = [startLine, startLine + 1]; t.info = "";
      state.line = startLine + 1;
      return true;
    }
    let nextLine = startLine + 1;
    let content = firstRest.trim() ? firstRest + "\n" : "";
    let found = false;
    while (nextLine < endLine) {
      const ns = state.bMarks[nextLine] + state.tShift[nextLine];
      const ne = state.eMarks[nextLine];
      const lineText = state.src.slice(ns, ne);
      if (lineText.trim() === "$$") { found = true; break; }
      content += lineText + "\n";
      nextLine++;
    }
    if (!found) return false;
    const t = state.push("math_block", "div", 0);
    t.block = true; t.markup = "$$"; t.content = content.trim(); t.map = [startLine, nextLine + 1]; t.info = "";
    state.line = nextLine + 1;
    return true;
  });
  md.renderer.rules.math_block = (tokens: any[], idx: number) =>
    `<div class="math-block" data-latex="${escapeAttr(tokens[idx].content)}"></div>`;
}

function renderKatex(target: HTMLElement, latex: string, displayMode: boolean) {
  target.innerHTML = "";
  try {
    katex.render(latex || "", target, { displayMode, throwOnError: false, output: "html" });
  } catch {
    target.textContent = latex;
  }
}

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span.math-inline", getAttrs: (el: HTMLElement) => ({ latex: el.getAttribute("data-latex") || "" }) }];
  },
  renderHTML({ node }: any) {
    return ["span", { class: "math-inline", "data-latex": node.attrs.latex }];
  },
  addNodeView() {
    return ({ node: initialNode, getPos, editor }: any) => {
      let node = initialNode;
      let editing = false;
      const dom = document.createElement("span");
      dom.className = "math-inline";
      function render() {
        dom.innerHTML = "";
        dom.classList.toggle("editing", editing);
        if (editing) {
          const input = document.createElement("input");
          input.type = "text";
          input.className = "math-edit math-edit-inline";
          input.value = node.attrs.latex;
          dom.appendChild(input);
          input.focus();
          input.select();
          const commit = () => {
            const v = input.value;
            const pos = getPos();
            editing = false;
            if (typeof pos === "number" && v !== node.attrs.latex) {
              editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { latex: v }));
            }
            render();
          };
          input.addEventListener("blur", commit);
          input.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter") { e.preventDefault(); input.blur(); }
            else if (e.key === "Escape") { editing = false; render(); }
          });
        } else {
          renderKatex(dom, node.attrs.latex, false);
        }
      }
      render();
      dom.addEventListener("mousedown", (e: MouseEvent) => {
        if (editing) return;
        e.preventDefault();
        editing = true;
        render();
      });
      return {
        dom,
        update: (n: any) => {
          if (n.type !== node.type) return false;
          node = n;
          if (!editing) render();
          return true;
        },
        stopEvent: () => editing,
      };
    };
  },
  addStorage() {
    return {
      markdown: {
        serialize: (state: any, node: any) => {
          state.write(`$${node.attrs.latex}$`);
        },
      },
    };
  },
});

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div.math-block", getAttrs: (el: HTMLElement) => ({ latex: el.getAttribute("data-latex") || "" }) }];
  },
  renderHTML({ node }: any) {
    return ["div", { class: "math-block", "data-latex": node.attrs.latex }];
  },
  addNodeView() {
    return ({ node: initialNode, getPos, editor }: any) => {
      let node = initialNode;
      let editing = false;
      const dom = document.createElement("div");
      dom.className = "math-block";

      function render() {
        dom.innerHTML = "";
        dom.classList.toggle("editing", editing);
        if (editing) {
          const ta = document.createElement("textarea");
          ta.className = "math-edit";
          ta.value = node.attrs.latex;
          ta.rows = 2;
          dom.appendChild(ta);
          ta.focus();
          ta.select();
          ta.addEventListener("blur", () => {
            const v = ta.value;
            const pos = getPos();
            editing = false;
            if (typeof pos === "number" && v !== node.attrs.latex) {
              editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { latex: v }));
            }
            render();
          });
          ta.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape") { editing = false; render(); }
          });
        } else {
          renderKatex(dom, node.attrs.latex, true);
        }
      }
      render();

      dom.addEventListener("mousedown", (e: MouseEvent) => {
        if (editing) return;
        e.preventDefault();
        editing = true;
        render();
      });

      return {
        dom,
        update: (n: any) => {
          if (n.type !== node.type) return false;
          node = n;
          if (!editing) render();
          return true;
        },
        stopEvent: () => editing,
      };
    };
  },
  addStorage() {
    return {
      markdown: {
        // 解析插件只需注册一次（行内+块规则全局生效）
        parse: {
          setup(md: any) {
            md.use(mathPlugin);
          },
        },
        serialize: (state: any, node: any) => {
          state.write("$$\n");
          state.text(node.attrs.latex, false);
          state.ensureNewLine();
          state.write("$$");
          state.closeBlock(node);
        },
      },
    };
  },
});
