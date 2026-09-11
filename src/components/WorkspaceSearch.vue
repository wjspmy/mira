<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { basename } from "../utils/path";

const props = defineProps<{
  workspaceRoot: string | null;
}>();

const emit = defineEmits<{
  close: [];
  open: [path: string];
}>();

const query = ref("");
const loading = ref(false);
const error = ref("");
const results = ref<Array<{ path: string; line: number; preview: string }>>([]);
const searchRoot = ref<"workspace" | "open">("workspace");

const placeholder = computed(() =>
  searchRoot.value === "workspace" ? "在工作区中搜索…" : "仅搜索已打开文件",
);

let token = 0;

async function runSearch() {
  const q = query.value.trim();
  if (!q) {
    results.value = [];
    return;
  }
  if (!props.workspaceRoot) {
    error.value = "请先打开文件夹";
    return;
  }
  const id = ++token;
  loading.value = true;
  error.value = "";
  try {
    const files = await invoke<string[]>("list_workspace_files", {
      root: props.workspaceRoot,
      maxResults: 400,
    });
    const mdFiles = files.filter((f) => /\.(md|markdown|txt)$/i.test(f));
    const hits: Array<{ path: string; line: number; preview: string }> = [];
    const needle = q.toLowerCase();
    for (const path of mdFiles.slice(0, 200)) {
      if (id !== token) return;
      try {
        const text = await invoke<string>("read_text_file", { path });
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(needle)) {
            hits.push({
              path,
              line: i + 1,
              preview: lines[i].trim().slice(0, 160),
            });
            if (hits.length >= 80) break;
          }
        }
      } catch {
        /* skip unreadable */
      }
      if (hits.length >= 80) break;
    }
    if (id !== token) return;
    results.value = hits;
  } catch (e) {
    if (id === token) error.value = String(e);
  } finally {
    if (id === token) loading.value = false;
  }
}

watch(query, () => {
  void runSearch();
});

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  }
}
</script>

<template>
  <div class="ws-search modal-backdrop" @click.self="emit('close')" @keydown="onKeydown">
    <section class="ws-search-panel" role="dialog" aria-modal="true" aria-label="工作区搜索">
      <header class="modal-header">
        <div>
          <h2>工作区搜索</h2>
          <p v-if="workspaceRoot" class="ws-search-root" :title="workspaceRoot">{{ workspaceRoot }}</p>
          <p v-else>尚未打开文件夹</p>
        </div>
        <button type="button" class="icon-btn" title="关闭" @click="emit('close')">×</button>
      </header>
      <div class="ws-search-bar">
        <input
          v-model="query"
          class="find-input"
          type="search"
          :placeholder="placeholder"
          spellcheck="false"
          autofocus
        />
        <span v-if="loading" class="ws-search-status">搜索中…</span>
        <span v-else-if="query && results.length" class="ws-search-status">{{ results.length }} 处</span>
      </div>
      <p v-if="error" class="ws-search-error">{{ error }}</p>
      <div class="ws-search-results">
        <button
          v-for="item in results"
          :key="`${item.path}:${item.line}`"
          type="button"
          class="ws-search-item"
          @click="emit('open', item.path)"
        >
          <span class="ws-search-file">{{ basename(item.path) }}</span>
          <span class="ws-search-line">L{{ item.line }}</span>
          <span class="ws-search-preview">{{ item.preview }}</span>
        </button>
        <div v-if="query && !loading && !results.length && !error" class="ws-search-empty">
          无匹配结果
        </div>
      </div>
    </section>
  </div>
</template>
