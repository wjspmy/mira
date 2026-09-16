<script setup lang="ts">
import { computed } from "vue";
import { basename } from "../utils/path";

const props = defineProps<{
  recentPaths: string[];
}>();

const emit = defineEmits<{
  newDoc: [];
  openFile: [];
  openFolder: [];
  openRecent: [path: string];
}>();

const recentTop = computed(() => props.recentPaths.slice(0, 6));
</script>

<template>
  <div class="welcome">
    <div class="welcome-brand">
      <div class="welcome-mark" aria-hidden="true">M</div>
      <h1>Mira</h1>
      <p>所见即所得的 Markdown 编辑器</p>
    </div>

    <div class="welcome-actions">
      <button type="button" class="welcome-btn primary" @click="emit('newDoc')">
        <span class="welcome-label">新建文档</span>
        <span class="welcome-kbd">Ctrl+N</span>
      </button>
      <button type="button" class="welcome-btn" @click="emit('openFile')">
        <span class="welcome-label">打开文件</span>
        <span class="welcome-kbd">Ctrl+O</span>
      </button>
      <button type="button" class="welcome-btn" @click="emit('openFolder')">
        <span class="welcome-label">打开文件夹</span>
        <span class="welcome-kbd">Ctrl+Shift+O</span>
      </button>
    </div>

    <div v-if="recentTop.length" class="welcome-recent">
      <h2>最近打开</h2>
      <ul>
        <li v-for="p in recentTop" :key="p">
          <button type="button" class="welcome-recent-item" :title="p" @click="emit('openRecent', p)">
            <span class="welcome-recent-name">{{ basename(p) }}</span>
            <span class="welcome-recent-path">{{ p }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
