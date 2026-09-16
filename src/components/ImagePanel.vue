<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  src: string;
  alt: string;
}>();

const emit = defineEmits<{
  change: [payload: { src: string; alt: string }];
  remove: [];
  close: [];
}>();

const alt = ref(props.alt);
watch(() => props.alt, (v) => { alt.value = v; });

function apply() {
  emit("change", { src: props.src, alt: alt.value });
}
</script>

<template>
  <div class="img-panel" role="dialog" aria-label="图片属性" @mousedown.stop>
    <div class="img-panel-src" :title="src">{{ src || "（空）" }}</div>
    <label class="img-panel-label">
      alt
      <input v-model="alt" class="find-input" type="text" placeholder="替代文本" @change="apply" />
    </label>
    <div class="img-panel-actions">
      <button type="button" class="img-panel-btn" @click="emit('close')">关闭</button>
      <button type="button" class="img-panel-btn danger" @click="emit('remove')">删除</button>
    </div>
  </div>
</template>
