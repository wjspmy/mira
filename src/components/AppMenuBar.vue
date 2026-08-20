<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { ShortcutCommandId } from "../shortcuts/registry";
import { buildAppMenuGroups, type AppMenuCommandId, type AppMenuItem } from "../menus/appMenu";

const props = defineProps<{
  recentPaths: string[];
  shortcuts: Partial<Record<ShortcutCommandId, string>>;
  hasActiveDoc: boolean;
  hasOpenTabs: boolean;
  editorMode?: "visual" | "source";
}>();

const emit = defineEmits<{
  "run-command": [commandId: AppMenuCommandId];
  "open-recent": [path: string];
}>();

const root = ref<HTMLElement | null>(null);
const openGroupId = ref<string | null>(null);

const groups = computed(() => buildAppMenuGroups(props));

function toggleGroup(groupId: string) {
  openGroupId.value = openGroupId.value === groupId ? null : groupId;
}

function focusGroup(groupId: string) {
  if (openGroupId.value) openGroupId.value = groupId;
}

function closeMenu() {
  openGroupId.value = null;
}

function activateItem(item: AppMenuItem) {
  if (item.disabled || item.section) return;
  closeMenu();
  if (item.recentPath) {
    emit("open-recent", item.recentPath);
    return;
  }
  if (item.id) emit("run-command", item.id);
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) closeMenu();
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") closeMenu();
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("keydown", onDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeydown);
});
</script>

<template>
  <nav ref="root" class="app-menu" aria-label="应用菜单">
    <div v-for="group in groups" :key="group.id" class="app-menu-group">
      <button
        type="button"
        class="app-menu-trigger"
        :class="{ active: openGroupId === group.id }"
        aria-haspopup="menu"
        :aria-expanded="openGroupId === group.id"
        @click.stop="toggleGroup(group.id)"
        @pointerenter="focusGroup(group.id)"
      >
        {{ group.label }}
      </button>
      <div v-if="openGroupId === group.id" class="app-menu-dropdown" role="menu" @click.stop>
        <template v-for="(item, index) in group.items" :key="item.id ?? item.recentPath ?? item.label + index">
          <div v-if="item.separatorBefore" class="app-menu-separator" aria-hidden="true"></div>
          <div v-if="item.section" class="app-menu-section">{{ item.label }}</div>
          <button
            v-else
            type="button"
            class="app-menu-item"
            :class="{ danger: item.danger, inset: item.inset, active: item.active }"
            :disabled="item.disabled"
            :title="item.title"
            role="menuitem"
            @click="activateItem(item)"
          >
            <span class="app-menu-label">{{ item.label }}</span>
            <span v-if="item.shortcut" class="app-menu-shortcut">{{ item.shortcut }}</span>
          </button>
        </template>
      </div>
    </div>
  </nav>
</template>
