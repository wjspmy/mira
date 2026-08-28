import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type ChangeSpec, type Extension, type StateCommand } from "@codemirror/state";
import { drawSelection, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";

export type SourceTextChange = (value: string) => void;
export type SourceHistoryFallback = () => void;

export interface SourceEditorHandlers {
  onChange?: SourceTextChange;
  onUndoFallback?: SourceHistoryFallback;
  onRedoFallback?: SourceHistoryFallback;
}

function historyCommandWithFallback(command: StateCommand, fallback?: SourceHistoryFallback): StateCommand {
  return (target) => {
    if (command(target)) return true;
    fallback?.();
    return true;
  };
}

export function sourceDocumentChange(current: string, next: string): ChangeSpec | null {
  if (current === next) return null;
  return { from: 0, to: current.length, insert: next };
}

export function createSourceEditorState(value: string, handlers: SourceEditorHandlers = {}): EditorState {
  const sourceUndo = historyCommandWithFallback(undo, handlers.onUndoFallback);
  const sourceRedo = historyCommandWithFallback(redo, handlers.onRedoFallback);
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLine(),
    drawSelection(),
    history(),
    keymap.of([
      { key: "Mod-z", run: sourceUndo },
      { key: "Mod-y", run: sourceRedo },
      { key: "Mod-Shift-z", run: sourceRedo },
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    markdown(),
    syntaxHighlighting(defaultHighlightStyle),
  ];

  if (handlers.onChange) {
    extensions.push(EditorState.transactionExtender.of((transaction) => {
      if (transaction.docChanged) handlers.onChange?.(transaction.newDoc.toString());
      return null;
    }));
  }

  return EditorState.create({
    doc: value,
    extensions,
  });
}
