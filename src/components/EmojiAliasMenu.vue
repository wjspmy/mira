<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { searchEmojiAliases } from "../editor/emoji-aliases";

const props = defineProps<{
  query: string;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  run: [payload: { name: string; emoji: string }];
  close: [];
}>();

const index = ref(0);
const list = computed(() => searchEmojiAliases(props.query));

watch(list, () => {
  index.value = 0;
});

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    index.value = Math.min(index.value + 1, Math.max(0, list.value.length - 1));
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    index.value = Math.max(index.value - 1, 0);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const item = list.value[index.value];
    if (item) emit("run", item);
  } else if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, true));
</script>

<template>
  <div
    class="emoji-alias-menu slash-menu"
    :style="{ left: `${x}px`, top: `${y}px` }"
    role="listbox"
    aria-label="Emoji 短代码"
  >
    <div v-if="!list.length" class="slash-empty">无匹配</div>
    <button
      v-for="(item, i) in list"
      :key="item.name"
      type="button"
      class="slash-item"
      :class="{ active: i === index }"
      @mousedown.prevent="emit('run', item)"
      @mouseenter="index = i"
    >
      <span class="slash-label">{{ item.emoji }} :{{ item.name }}:</span>
      <span class="slash-hint">Enter</span>
    </button>
  </div>
</template>
