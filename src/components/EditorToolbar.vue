<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  HEADING_MENU,
  MAIN_TOOLBAR_BUTTONS,
  MORE_MENU,
  TOOLBAR_ICONS,
  UTILITY_BUTTONS,
  headingLabelFromActive,
  type EditorToolbarAction,
  type ToolbarActiveMap,
  type ToolbarButtonDef,
} from "../editor/toolbar";

const props = defineProps<{
  disabled?: boolean;
  mode: "visual" | "source";
  active?: ToolbarActiveMap;
}>();

const emit = defineEmits<{
  action: [action: EditorToolbarAction];
}>();

const openMenu = ref<"heading" | "more" | null>(null);
const root = ref<HTMLElement | null>(null);

const headingLabel = computed(() => headingLabelFromActive(props.active));
const headingActive = computed(() =>
  HEADING_MENU.some((item) => props.active?.[item.id]),
);

function isActive(id: EditorToolbarAction) {
  return Boolean(props.active?.[id]);
}

function onButton(btn: ToolbarButtonDef) {
  if (btn.dropdown) {
    openMenu.value = openMenu.value === btn.dropdown ? null : btn.dropdown;
    return;
  }
  openMenu.value = null;
  emit("action", btn.id);
}

function onMenuAction(id: EditorToolbarAction) {
  openMenu.value = null;
  emit("action", id);
}

function onDocPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) openMenu.value = null;
}

onMounted(() => document.addEventListener("pointerdown", onDocPointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocPointerDown));

const disabledAll = computed(() => props.disabled || props.mode !== "visual");
</script>

<template>
  <div ref="root" class="md-toolbar" role="toolbar" aria-label="格式工具栏">
    <!-- 左：主命令 -->
    <div class="md-toolbar-left">
      <template v-for="(btn, index) in MAIN_TOOLBAR_BUTTONS" :key="btn.id + index">
        <span
          v-if="btn.id === 'bold' || btn.id === 'bulletList' || btn.id === 'link'"
          class="md-toolbar-sep"
          aria-hidden="true"
        />
        <button
          v-if="!btn.dropdown"
          type="button"
          class="md-toolbar-btn"
          :class="{ active: isActive(btn.id) }"
          :title="btn.title"
          :aria-label="btn.title"
          :aria-pressed="btn.toggle ? isActive(btn.id) : undefined"
          :disabled="disabledAll"
          @click="onButton(btn)"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              :d="TOOLBAR_ICONS[btn.icon]"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <!-- 标题下拉 -->
        <div v-else-if="btn.dropdown === 'heading'" class="md-toolbar-dropdown">
          <button
            type="button"
            class="md-toolbar-btn md-toolbar-heading-trigger"
            :class="{ active: headingActive || openMenu === 'heading' }"
            title="标题级别"
            :disabled="disabledAll"
            @click="onButton(btn)"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                :d="TOOLBAR_ICONS.heading"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="md-toolbar-heading-label">{{ headingLabel }}</span>
            <svg class="md-caret" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
              <path d="M1 2.5L4 5.5L7 2.5" fill="none" stroke="currentColor" stroke-width="1.2" />
            </svg>
          </button>
          <div v-if="openMenu === 'heading'" class="md-menu" role="menu">
            <button
              v-for="item in HEADING_MENU"
              :key="item.id"
              type="button"
              class="md-menu-item"
              :class="{ active: isActive(item.id) }"
              role="menuitem"
              @click="onMenuAction(item.id)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 右：大纲 / 源码 / 更多 -->
    <div class="md-toolbar-right">
      <template v-for="btn in UTILITY_BUTTONS" :key="btn.id">
        <div v-if="btn.dropdown === 'more'" class="md-toolbar-dropdown">
          <button
            type="button"
            class="md-toolbar-btn"
            :class="{ active: openMenu === 'more' }"
            :title="btn.title"
            :disabled="disabledAll"
            @click="onButton(btn)"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                :d="TOOLBAR_ICONS[btn.icon]"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <div v-if="openMenu === 'more'" class="md-menu md-menu-right" role="menu">
            <template v-for="item in MORE_MENU" :key="item.id">
              <div v-if="item.separatorBefore" class="md-menu-sep" />
              <button
                type="button"
                class="md-menu-item"
                role="menuitem"
                :disabled="disabledAll"
                @click="onMenuAction(item.id)"
              >
                {{ item.label }}
              </button>
            </template>
          </div>
        </div>
        <button
          v-else
          type="button"
          class="md-toolbar-btn"
          :class="{ active: btn.id === 'toggleSourceMode' && mode === 'source' }"
          :title="btn.title"
          :disabled="disabled"
          @click="onButton(btn)"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              :d="TOOLBAR_ICONS[btn.icon]"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </template>
    </div>
  </div>
</template>
