<script setup lang="ts">
import { computed, ref } from "vue";
import { EMOJI_GROUPS, filterEmoji } from "../editor/emoji";

const props = withDefaults(
  defineProps<{
    x?: number;
    y?: number;
  }>(),
  { x: 200, y: 200 },
);

const emit = defineEmits<{
  pick: [emoji: string];
  close: [];
}>();

const query = ref("");
const groups = computed(() => {
  const q = query.value.trim();
  if (!q) return EMOJI_GROUPS;
  return filterEmoji(q).filter((g) => g.items.length);
});
</script>

<template>
  <div
    class="emoji-panel"
    :style="{ left: `${props.x}px`, top: `${props.y}px` }"
    role="dialog"
    aria-label="Emoji"
  >
    <div class="emoji-head">
      <input
        v-model="query"
        class="find-input"
        type="search"
        placeholder="搜索 emoji"
        spellcheck="false"
        @keydown.esc="emit('close')"
      />
      <button type="button" class="icon-btn" title="关闭" @click="emit('close')">×</button>
    </div>
    <div class="emoji-body">
      <section v-for="group in groups" :key="group.label" class="emoji-group">
        <h4>{{ group.label }}</h4>
        <div class="emoji-grid">
          <button
            v-for="(e, i) in group.items"
            :key="group.label + i"
            type="button"
            class="emoji-btn"
            :title="e"
            @mousedown.prevent="emit('pick', e)"
          >
            {{ e }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
