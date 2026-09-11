import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const FocusModeKey = new PluginKey("mira-focus-mode");

function isFocusModeEnabled(): boolean {
  return document.documentElement.dataset.focusMode === "1";
}

function topLevelIndexAtPos(doc: import("@tiptap/pm/model").Node, pos: number): number {
  let offset = 0;
  let found = 0;
  doc.forEach((child, _off, index) => {
    const start = offset;
    const end = offset + child.nodeSize;
    if (pos >= start && pos <= end) found = index;
    offset = end;
  });
  return found;
}

/**
 * 专注模式：用 ProseMirror Decoration 高亮当前顶层块。
 * 注意：绝不能直接改 contentDOM 的 class，会触发 DOM Observer 死循环导致界面卡死。
 */
export const FocusModeHighlight = Extension.create({
  name: "miraFocusMode",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: FocusModeKey,
        props: {
          decorations(state) {
            if (!isFocusModeEnabled()) return null;
            const { doc, selection } = state;
            const active = topLevelIndexAtPos(doc, selection.from);
            const decos: Decoration[] = [];
            let pos = 0;
            doc.forEach((node, _offset, index) => {
              const cls = index === active ? "mira-focus-active" : "mira-focus-dim";
              decos.push(Decoration.node(pos, pos + node.nodeSize, { class: cls }));
              pos += node.nodeSize;
            });
            return DecorationSet.create(doc, decos);
          },
        },
      }),
    ];
  },
});
