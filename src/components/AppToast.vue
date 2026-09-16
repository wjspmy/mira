<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";

export type ToastKind = "info" | "success" | "warn" | "error";

const props = defineProps<{
  message: string;
  kind?: ToastKind;
  timeoutMs?: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

let timer: ReturnType<typeof setTimeout> | null = null;

const cls = computed(() => `toast toast-${props.kind || "info"}`);

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => emit("close"), props.timeoutMs ?? 4200);
}

watch(() => props.message, () => schedule(), { immediate: true });

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite">
    <div :class="cls">
      <span class="toast-msg">{{ message }}</span>
      <button type="button" class="toast-close" title="关闭" @click="emit('close')">×</button>
    </div>
  </div>
</template>
