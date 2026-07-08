<script setup lang="ts">
import { useWorkspaceStore, type FileNode } from "../stores/workspace";

const props = defineProps<{ node: FileNode; depth: number }>();
const emit = defineEmits<{
  (e: "open-file", path: string): void;
  (e: "context-menu", node: FileNode, event: MouseEvent): void;
}>();
const ws = useWorkspaceStore();

async function onClick() {
  if (props.node.isDir) {
    await ws.toggle(props.node.path);
  } else {
    emit("open-file", props.node.path);
  }
}

const kids = () => (props.node.isDir ? ws.childrenOf(props.node.path) : null);
</script>

<template>
  <div>
    <div
      class="tree-row"
      :class="{ dir: node.isDir, expanded: node.isDir && ws.isExpanded(node.path) }"
      :style="{ paddingLeft: depth * 14 + 8 + 'px' }"
      @click="onClick"
      @contextmenu.prevent.stop="emit('context-menu', node, $event)"
    >
      <span class="chevron">{{ node.isDir ? (ws.isExpanded(node.path) ? "▾" : "▸") : "·" }}</span>
      <span class="name">{{ node.name }}</span>
    </div>
    <div v-if="node.isDir && ws.isExpanded(node.path) && kids()" class="tree-children">
      <FileTreeNode
        v-for="child in kids()"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        @open-file="(p) => emit('open-file', p)"
        @context-menu="(n, e) => emit('context-menu', n, e)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
// 自引用递归组件：用 name 注册
export default defineComponent({ name: "FileTreeNode" });
</script>
