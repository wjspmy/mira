import { Extension } from "@tiptap/core";

/** 仅括号类配对；引号/强调符与 Markdown 语法、输入法冲突，不在这里抢按键。 */
const BRACKET_PAIRS: Array<{ open: string; close: string }> = [
  { open: "(", close: ")" },
  { open: "[", close: "]" },
  { open: "{", close: "}" },
];

/**
 * 输入自动配对（对标 Typora / MarkText，保守版）：
 * - ( [ { 自动补全右括号，光标居中
 * - 右括号若紧挨光标右侧则跳过
 * - 选中文字后输入左括号则包裹
 */
export const AutoPair = Extension.create({
  name: "miraAutoPair",

  addKeyboardShortcuts() {
    const shortcuts: Record<string, () => boolean> = {};

    for (const { open, close } of BRACKET_PAIRS) {
      shortcuts[open] = () => {
        const { state } = this.editor;
        const { empty, from, to } = state.selection;
        if (!empty) {
          const selected = state.doc.textBetween(from, to, "\n");
          return this.editor
            .chain()
            .focus()
            .insertContentAt({ from, to }, open + selected + close)
            .setTextSelection(from + 1 + selected.length)
            .run();
        }
        if (state.doc.textBetween(from, from + 1, "\n") === close) {
          return this.editor.chain().focus().setTextSelection(from + 1).run();
        }
        return this.editor
          .chain()
          .focus()
          .insertContent(open + close)
          .setTextSelection(from + 1)
          .run();
      };

      shortcuts[close] = () => {
        const { state } = this.editor;
        const { empty, from } = state.selection;
        if (!empty) return false;
        if (state.doc.textBetween(from, from + 1, "\n") === close) {
          return this.editor.chain().focus().setTextSelection(from + 1).run();
        }
        return false;
      };
    }

    return shortcuts;
  },
});
