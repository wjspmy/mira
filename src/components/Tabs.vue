<script setup lang="ts">
import { useSessionStore } from "../stores/session";

const session = useSessionStore();
defineEmits<{ (e: "close", id: string): void }>();

function name(d: { filePath: string | null }): string {
  if (!d.filePath) return "未命名";
  const a = d.filePath.split(/[\\/]/);
  return a[a.length - 1];
}
</script>

<template>
  <div class="tabs">
    <div
      v-for="d in session.docs"
      :key="d.id"
      class="tab"
      :class="{ active: d.id === session.activeId }"
      @click="session.setActive(d.id)"
      :title="d.filePath ?? '未命名'"
    >
      <span class="tab-dot" :class="{ dirty: d.dirty }">{{ d.dirty ? "●" : "" }}</span>
      <span class="tab-name">{{ name(d) }}</span>
      <span class="tab-close" @click.stop="$emit('close', d.id)" title="关闭">×</span>
    </div>
  </div>
</template>
