<script setup lang="ts">
import { computed } from "vue";
import type { OutlineItem } from "../editor/outline";

const props = defineProps<{
  items: OutlineItem[];
  activeOffset?: number;
}>();

const emit = defineEmits<{
  select: [item: OutlineItem];
  close: [];
}>();

const nested = computed(() => {
  const min = Math.min(6, ...props.items.map((i) => i.level), 6);
  return props.items.map((item) => ({
    ...item,
    indent: Math.max(0, item.level - min),
  }));
});
</script>

<template>
  <aside class="outline-panel" aria-label="大纲">
    <header class="outline-header">
      <span>大纲</span>
      <button type="button" class="icon-btn" title="关闭大纲" @click="emit('close')">×</button>
    </header>
    <div v-if="!nested.length" class="outline-empty">当前文档没有标题</div>
    <nav v-else class="outline-list">
      <button
        v-for="(item, index) in nested"
        :key="`${item.line}-${index}`"
        type="button"
        class="outline-item"
        :class="{
          [`level-${item.level}`]: true,
          active: activeOffset !== undefined && Math.abs(item.offset - activeOffset) < 2,
        }"
        :style="{ paddingLeft: `${10 + item.indent * 12}px` }"
        :title="`${item.text} · L${item.line}`"
        @click="emit('select', item)"
      >
        {{ item.text }}
      </button>
    </nav>
  </aside>
</template>
