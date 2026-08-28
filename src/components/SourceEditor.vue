<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { redo, undo } from "@codemirror/commands";
import { EditorSelection, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createSourceEditorState, sourceDocumentChange } from "../editor/source-editor";

const props = defineProps<{
  modelValue: string;
  docId: string;
}>();

const emit = defineEmits<{
  "update:model-value": [value: string];
  "undo-fallback": [];
  "redo-fallback": [];
}>();

const host = ref<HTMLElement | null>(null);
let view: EditorView | null = null;

function collapseSelection() {
  if (!view) return;
  const head = view.state.selection.main.head;
  const cursor = Math.min(Math.max(head, 0), view.state.doc.length);
  view.dispatch({
    selection: EditorSelection.cursor(cursor),
    annotations: Transaction.addToHistory.of(false),
  });
}

function mountEditor() {
  if (!host.value) return;
  view = new EditorView({
    state: createSourceEditorState(props.modelValue, {
      onChange: (value) => emit("update:model-value", value),
      onUndoFallback: () => emit("undo-fallback"),
      onRedoFallback: () => emit("redo-fallback"),
    }),
    parent: host.value,
  });
  view.focus();
  collapseSelection();
}

watch(() => props.modelValue, (value) => {
  if (!view) return;
  const change = sourceDocumentChange(view.state.doc.toString(), value);
  if (change) {
    view.dispatch({
      changes: change,
      annotations: Transaction.addToHistory.of(false),
    });
  }
  collapseSelection();
});

function undoSource() {
  if (!view) return false;
  if (undo(view)) return true;
  emit("undo-fallback");
  return true;
}

function redoSource() {
  if (!view) return false;
  if (redo(view)) return true;
  emit("redo-fallback");
  return true;
}

function focusEditor() {
  if (!view) return;
  view.focus();
  collapseSelection();
}

defineExpose({
  undo: undoSource,
  redo: redoSource,
  focus: focusEditor,
  collapseSelection,
});

onMounted(mountEditor);
onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});
</script>

<template>
  <div ref="host" class="source-editor" :data-doc-id="docId" aria-label="Markdown 源码编辑器"></div>
</template>
