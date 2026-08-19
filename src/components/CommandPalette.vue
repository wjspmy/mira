<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { buildPaletteEntries, searchPaletteEntries, type PaletteEntry } from "../command-palette/model";
import { SHORTCUT_COMMANDS, type ShortcutCommandId } from "../shortcuts/registry";

const props = defineProps<{
  shortcuts: Partial<Record<ShortcutCommandId, string>>;
  openPaths: string[];
  recentPaths: string[];
  workspacePaths: string[];
  loading: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  close: [];
  "run-command": [commandId: ShortcutCommandId];
  "open-file": [path: string];
  "query-change": [query: string];
}>();

const input = ref<HTMLInputElement | null>(null);
const query = ref("");
const selectedIndex = ref(0);

const entries = computed(() => buildPaletteEntries({
  commands: SHORTCUT_COMMANDS,
  shortcuts: props.shortcuts,
  openPaths: props.openPaths,
  recentPaths: props.recentPaths,
  workspacePaths: props.workspacePaths,
}));
const results = computed(() => searchPaletteEntries(entries.value, query.value));
const selected = computed<PaletteEntry | null>(() => results.value[selectedIndex.value] ?? null);

watch(results, (next) => {
  if (!next.length) selectedIndex.value = 0;
  else if (selectedIndex.value >= next.length) selectedIndex.value = next.length - 1;
});

watch(query, (next) => {
  selectedIndex.value = 0;
  emit("query-change", next);
});

function close() {
  emit("close");
}

function activate(entry: PaletteEntry | null = selected.value) {
  if (!entry) return;
  if (entry.commandId) emit("run-command", entry.commandId);
  else if (entry.path) emit("open-file", entry.path);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    if (results.value.length) selectedIndex.value = (selectedIndex.value + 1) % results.value.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (results.value.length) selectedIndex.value = (selectedIndex.value - 1 + results.value.length) % results.value.length;
  } else if (event.key === "Enter") {
    event.preventDefault();
    activate();
  }
}

onMounted(() => {
  nextTick(() => input.value?.focus());
});
</script>

<template>
  <div class="command-palette-backdrop" @mousedown.self="close">
    <section class="command-palette" role="dialog" aria-modal="true" aria-label="命令面板" @keydown="onKeydown">
      <div class="command-palette-input-wrap">
        <span class="command-palette-icon" aria-hidden="true">⌕</span>
        <input
          ref="input"
          v-model="query"
          class="command-palette-input"
          type="text"
          placeholder="搜索命令或文件…"
          autocomplete="off"
          spellcheck="false"
        />
        <kbd>Esc</kbd>
      </div>

      <div class="command-palette-results" role="listbox">
        <div v-if="loading && query.trim().length >= 2" class="command-palette-note">正在准备工作区文件…</div>
        <div v-if="error && query.trim()" class="command-palette-note error">{{ error }}</div>
        <button
          v-for="(entry, index) in results"
          :key="entry.key"
          type="button"
          class="command-palette-item"
          :class="{ active: index === selectedIndex }"
          role="option"
          :aria-selected="index === selectedIndex"
          @mouseenter="selectedIndex = index"
          @click="activate(entry)"
        >
          <span class="command-palette-kind">{{ entry.kind === "command" ? "›" : "⌁" }}</span>
          <span class="command-palette-copy">
            <span class="command-palette-title">{{ entry.title }}</span>
            <span v-if="entry.subtitle" class="command-palette-subtitle">{{ entry.subtitle }}</span>
          </span>
          <kbd v-if="entry.shortcut" class="command-palette-shortcut">{{ entry.shortcut }}</kbd>
        </button>
        <div v-if="!loading && !results.length" class="command-palette-note">没有匹配的命令或文件</div>
      </div>

      <footer class="command-palette-footer">
        <span><kbd>↑↓</kbd> 选择</span>
        <span><kbd>Enter</kbd> 执行</span>
        <span>命令优先，文件随后</span>
      </footer>
    </section>
  </div>
</template>
