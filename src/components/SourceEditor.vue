<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { redo, undo } from "@codemirror/commands";
import { EditorSelection, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createSourceEditorState, sourceDocumentChange } from "../editor/source-editor";
import { clampTextSelection, type TextSelection } from "../editor/selection";
import { isHugeDocument } from "../editor/large-doc";

const props = defineProps<{
  modelValue: string;
  docId: string;
  initialSelection?: TextSelection | null;
}>();

const emit = defineEmits<{
  "update:model-value": [value: string];
  "undo-fallback": [];
  "redo-fallback": [];
}>();

const host = ref<HTMLElement | null>(null);
let view: EditorView | null = null;
let changeTimer: ReturnType<typeof setTimeout> | null = null;

function getSelection(): TextSelection | null {
  if (!view) return null;
  const { from, to } = view.state.selection.main;
  return { from, to };
}

function applySelection(selection: TextSelection | null | undefined) {
  if (!view) return;
  const next = clampTextSelection(view.state.doc.length, selection);
  if (!next) return;
  view.dispatch({
    selection: EditorSelection.range(next.from, next.to),
    annotations: Transaction.addToHistory.of(false),
  });
}

/** 大文件每次击键 toString 代价高，防抖回传，避免源码模式打字卡顿。 */
function scheduleChangeEmit(value: string) {
  if (changeTimer) clearTimeout(changeTimer);
  if (!isHugeDocument(value) && value.length < 200 * 1024) {
    emit("update:model-value", value);
    return;
  }
  changeTimer = setTimeout(() => {
    changeTimer = null;
    if (!view) return;
    emit("update:model-value", view.state.doc.toString());
  }, 250);
}

function flushPendingChange() {
  if (!changeTimer || !view) return;
  clearTimeout(changeTimer);
  changeTimer = null;
  emit("update:model-value", view.state.doc.toString());
}

function mountEditor() {
  if (!host.value) return;
  const plain = isHugeDocument(props.modelValue);
  view = new EditorView({
    state: createSourceEditorState(
      props.modelValue,
      {
        onChange: (value) => scheduleChangeEmit(value),
        onUndoFallback: () => emit("undo-fallback"),
        onRedoFallback: () => emit("redo-fallback"),
      },
      { plain },
    ),
    parent: host.value,
  });
  view.focus();
  applySelection(props.initialSelection ?? { from: 0, to: 0 });
}

watch(() => props.modelValue, (value) => {
  if (!view) return;
  const current = view.state.doc.toString();
  if (current === value) return;
  const change = sourceDocumentChange(current, value);
  if (!change) return;
  const prevHead = view.state.selection.main.head;
  view.dispatch({
    changes: change,
    annotations: Transaction.addToHistory.of(false),
  });
  const head = Math.min(prevHead, view.state.doc.length);
  view.dispatch({
    selection: EditorSelection.cursor(head),
    annotations: Transaction.addToHistory.of(false),
  });
});

function undoSource() {
  flushPendingChange();
  if (!view) return false;
  if (undo(view)) return true;
  emit("undo-fallback");
  return true;
}

function redoSource() {
  flushPendingChange();
  if (!view) return false;
  if (redo(view)) return true;
  emit("redo-fallback");
  return true;
}

function focusEditor(selection?: TextSelection | null) {
  if (!view) return;
  view.focus();
  if (selection) applySelection(selection);
}

defineExpose({
  undo: undoSource,
  redo: redoSource,
  focus: focusEditor,
  getSelection,
  setSelection: applySelection,
  flushPendingChange,
});

onMounted(mountEditor);
onBeforeUnmount(() => {
  flushPendingChange();
  if (changeTimer) clearTimeout(changeTimer);
  view?.destroy();
  view = null;
});
</script>

<template>
  <div ref="host" class="source-editor" :data-doc-id="docId" aria-label="Markdown 源码编辑器"></div>
</template>
