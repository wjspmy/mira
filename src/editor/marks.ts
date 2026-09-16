import { Mark, markInputRule, markPasteRule } from "@tiptap/core";

/** ==高亮==（MarkText / Vditor / GitHub 风格） */
export const HighlightMark = Mark.create({
  name: "highlight",
  parseHTML: () => [{ tag: "mark" }],
  renderHTML: ({ HTMLAttributes }) => ["mark", HTMLAttributes, 0],
  addInputRules() {
    return [markInputRule({ find: /(?:^|\s)==([^=]+)==$/, type: this.type })];
  },
  addPasteRules() {
    return [markPasteRule({ find: /==([^=]+)==/g, type: this.type })];
  },
});

/** H~2~O 下标、x^2^ 上标 */
export const SubscriptMark = Mark.create({
  name: "subscript",
  parseHTML: () => [{ tag: "sub" }],
  renderHTML: ({ HTMLAttributes }) => ["sub", HTMLAttributes, 0],
  addInputRules() {
    return [markInputRule({ find: /(?:^|\s)([^~\s]+)~([^~]+)~$/, type: this.type })];
  },
  addPasteRules() {
    return [markPasteRule({ find: /([^~\s]+)~([^~]+)~/g, type: this.type })];
  },
});

export const SuperscriptMark = Mark.create({
  name: "superscript",
  parseHTML: () => [{ tag: "sup" }],
  renderHTML: ({ HTMLAttributes }) => ["sup", HTMLAttributes, 0],
  addInputRules() {
    return [markInputRule({ find: /(?:^|\s)([^\^\s]+)\^([^\^]+)\^$/, type: this.type })];
  },
  addPasteRules() {
    return [markPasteRule({ find: /([^\^\s]+)\^([^\^]+)\^/g, type: this.type })];
  },
});
