<script setup lang="ts">
import { TOOLBAR_GROUPS, type EditorToolbarAction } from "../editor/toolbar";

defineProps<{
  disabled?: boolean;
  mode: "visual" | "source";
}>();

const emit = defineEmits<{
  action: [action: EditorToolbarAction];
}>();

const CLASS_BY_ID: Partial<Record<EditorToolbarAction, string>> = {
  bold: "tb-bold",
  italic: "tb-italic",
  strike: "tb-strike",
  code: "tb-code",
};
</script>

<template>
  <div class="editor-toolbar" role="toolbar" aria-label="格式工具栏">
    <template v-for="group in TOOLBAR_GROUPS" :key="group.id">
      <div class="editor-toolbar-group">
        <button
          v-for="btn in group.buttons"
          :key="btn.id"
          type="button"
          class="editor-toolbar-btn"
          :class="CLASS_BY_ID[btn.id]"
          :title="btn.title"
          :disabled="disabled || mode !== 'visual'"
          @click="emit('action', btn.id)"
        >
          {{ btn.label }}
        </button>
      </div>
      <div v-if="group.id !== 'insert'" class="editor-toolbar-sep" aria-hidden="true"></div>
    </template>
  </div>
</template>
