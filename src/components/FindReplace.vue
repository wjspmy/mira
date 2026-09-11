<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from "vue";

const props = withDefaults(
  defineProps<{
    matchCount: number;
    currentIndex: number;
    mode: "visual" | "source";
    showReplace?: boolean;
    initialQuery?: string;
  }>(),
  {
    showReplace: false,
    initialQuery: "",
  },
);

const emit = defineEmits<{
  "update:query": [value: string];
  "update:replacement": [value: string];
  "update:useRegex": [value: boolean];
  "update:caseSensitive": [value: boolean];
  findNext: [];
  findPrev: [];
  replace: [];
  replaceAll: [];
  close: [];
}>();

const query = ref(props.initialQuery);
const replacement = ref("");
const useRegex = ref(false);
const caseSensitive = ref(false);
const expanded = ref(props.showReplace);
const findInput = ref<HTMLInputElement | null>(null);
const replaceInput = ref<HTMLInputElement | null>(null);

watch(query, (value) => emit("update:query", value));
watch(replacement, (value) => emit("update:replacement", value));
watch(useRegex, (value) => emit("update:useRegex", value));
watch(caseSensitive, (value) => emit("update:caseSensitive", value));

watch(
  () => props.showReplace,
  (value) => {
    expanded.value = value;
    if (value) void nextTick(() => replaceInput.value?.focus());
    else void nextTick(() => findInput.value?.focus());
  },
);

const statusText = computed(() => {
  if (!query.value) return "";
  if (!props.matchCount) return "无结果";
  return `${props.currentIndex + 1}/${props.matchCount}`;
});

function toggleReplace() {
  expanded.value = !expanded.value;
  void nextTick(() => {
    if (expanded.value) replaceInput.value?.focus();
    else findInput.value?.focus();
  });
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    emit("close");
    return;
  }
  if (event.key === "F3" || (event.key === "Enter" && event.target === findInput.value)) {
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) emit("findPrev");
    else emit("findNext");
    return;
  }
  if (event.key === "Enter" && event.target === replaceInput.value) {
    event.preventDefault();
    event.stopPropagation();
    emit("replace");
  }
}

onMounted(() => {
  findInput.value?.focus();
  findInput.value?.select();
});

onBeforeUnmount(() => {
  emit("close");
});
</script>

<template>
  <div class="vscode-find" role="search" @keydown="onKeydown" @mousedown.stop>
    <button
      type="button"
      class="vscode-find-chevron"
      :class="{ open: expanded }"
      :title="expanded ? '收起替换' : '展开替换'"
      @click="toggleReplace"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M3 1.5 L7.5 5 L3 8.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <div class="vscode-find-fields">
      <div class="vscode-find-row">
        <input
          ref="findInput"
          v-model="query"
          class="vscode-find-input"
          type="text"
          placeholder="查找"
          spellcheck="false"
          autocomplete="off"
        />
        <span class="vscode-find-count">{{ statusText }}</span>
      </div>
      <div v-if="expanded" class="vscode-find-row">
        <input
          ref="replaceInput"
          v-model="replacement"
          class="vscode-find-input"
          type="text"
          placeholder="替换"
          spellcheck="false"
          autocomplete="off"
        />
      </div>
    </div>

    <div class="vscode-find-actions">
      <button
        type="button"
        class="vscode-find-btn"
        :class="{ on: caseSensitive }"
        title="区分大小写"
        @click="caseSensitive = !caseSensitive"
      >
        <span class="opt-label">Aa</span>
      </button>
      <button
        type="button"
        class="vscode-find-btn"
        :class="{ on: useRegex }"
        title="使用正则表达式"
        @click="useRegex = !useRegex"
      >
        <span class="opt-label">.*</span>
      </button>
      <button type="button" class="vscode-find-btn" title="上一个 (Shift+Enter)" @click="emit('findPrev')">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 8 L6 4 L10 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button type="button" class="vscode-find-btn" title="下一个 (Enter)" @click="emit('findNext')">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button type="button" class="vscode-find-btn vscode-find-close" title="关闭 (Esc)" @click="emit('close')">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3 L9 9 M9 3 L3 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>

    <div v-if="expanded" class="vscode-find-replace-actions">
      <button type="button" class="vscode-find-btn text-btn" title="替换 (Enter)" @click="emit('replace')">替换</button>
      <button type="button" class="vscode-find-btn text-btn" title="全部替换" @click="emit('replaceAll')">全部</button>
    </div>
  </div>
</template>
