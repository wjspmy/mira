import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const FootnoteKey = new PluginKey("mira-footnotes");

const FOOTNOTE_REF = /\[\^([^\]\s]+)\]/g;
const FOOTNOTE_DEF = /^\[\^([^\]\s]+)\]:/;

/**
 * 脚注装饰：把 `[^id]` 标成上标引用，`[^id]:` 标成脚注定义。
 * 不改 schema，Markdown 以纯文本 round-trip（Zettlr / GitHub 风格）。
 */
export const FootnoteHighlight = Extension.create({
  name: "miraFootnotes",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: FootnoteKey,
        props: {
          decorations(state) {
            const { doc } = state;
            const builder: Array<{ pos: number; start: number; end: number; type: "ref" | "def"; id: string }> = [];
            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return true;
              const text = node.text;
              FOOTNOTE_REF.lastIndex = 0;
              for (const m of text.matchAll(FOOTNOTE_REF)) {
                if (m.index === undefined) continue;
                builder.push({
                  pos: pos + m.index,
                  start: pos + m.index,
                  end: pos + m.index + m[0].length,
                  type: "ref",
                  id: m[1],
                });
              }
              // 仅段落首行视为定义
              const parent = doc.nodeAt(pos - 1);
              void parent;
              return true;
            });
            // 定义：扫描段落
            doc.descendants((node, pos) => {
              if (node.type.name !== "paragraph") return true;
              const text = node.textContent;
              const def = FOOTNOTE_DEF.exec(text);
              if (def) {
                const start = pos + 1;
                builder.push({
                  pos: start,
                  start,
                  end: start + def[0].length,
                  type: "def",
                  id: def[1],
                });
              }
              return true;
            });
            if (!builder.length) return DecorationSet.empty;
            const decos = builder.map((item) =>
              Decoration.inline(item.start, item.end, {
                class: item.type === "ref" ? "mira-footnote-ref" : "mira-footnote-def",
                "data-footnote": item.id,
              }),
            );
            return DecorationSet.create(doc, decos);
          },
        },
      }),
    ];
  },
});
