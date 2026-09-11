<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { storeToRefs } from "pinia";
import { SHORTCUT_COMMANDS, SHORTCUT_COMMAND_BY_ID, SHORTCUT_GROUP_LABELS, type ShortcutCommand, type ShortcutCommandId, type ShortcutGroup } from "../shortcuts/registry";
import { displayShortcut, shortcutFromEvent } from "../shortcuts/keyboard";
import { useShortcutsStore } from "../stores/shortcuts";
import { useSettingsStore, type ImageStrategy, type ThemeSetting } from "../stores/settings";

const emit = defineEmits<{ (e: "close"): void }>();
const shortcuts = useShortcutsStore();
const settings = useSettingsStore();
const { bindings } = storeToRefs(shortcuts);
const { customCssPath, theme, editorFontSize, autoSaveDelayMs, imageStrategy } = storeToRefs(settings);
const capturing = ref<ShortcutCommandId | null>(null);
const message = ref("");

const groupedCommands = computed(() => {
  const groups: Array<{ group: ShortcutGroup; label: string; commands: ShortcutCommand[] }> = [];
  for (const command of SHORTCUT_COMMANDS) {
    let group = groups.find((item) => item.group === command.group);
    if (!group) {
      group = { group: command.group, label: SHORTCUT_GROUP_LABELS[command.group], commands: [] };
      groups.push(group);
    }
    group.commands.push(command);
  }
  return groups;
});

function startCapture(commandId: ShortcutCommandId) {
  capturing.value = commandId;
  message.value = "请按下新的快捷键组合，Esc 取消";
}

function stopCapture() {
  capturing.value = null;
  message.value = "";
}

function handleCapture(event: KeyboardEvent) {
  if (!capturing.value) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") {
    stopCapture();
    return;
  }
  const shortcut = shortcutFromEvent(event);
  if (!shortcut) {
    message.value = "请至少包含 Ctrl/Cmd、Alt 或功能键组合";
    return;
  }
  const conflict = shortcuts.setShortcut(capturing.value, shortcut);
  if (conflict) {
    message.value = `快捷键已被「${SHORTCUT_COMMAND_BY_ID[conflict].title}」使用`;
    return;
  }
  message.value = `已设置为 ${displayShortcut(shortcut)}`;
  capturing.value = null;
}

function resetCommand(commandId: ShortcutCommandId) {
  shortcuts.resetShortcut(commandId);
  message.value = `已恢复「${SHORTCUT_COMMAND_BY_ID[commandId].title}」默认快捷键`;
}

function resetAll() {
  shortcuts.resetAll();
  message.value = "已恢复全部默认快捷键";
}

async function chooseCustomCss() {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: "CSS", extensions: ["css"] }],
  });
  if (!selected) return;
  const path = typeof selected === "string" ? selected : (selected as any).path;
  if (!path) return;
  settings.setCustomCssPath(path);
  message.value = "已选择自定义 CSS，正在应用";
}

function clearCustomCssSetting() {
  settings.clearCustomCssPath();
  message.value = "已清除自定义 CSS";
}

function reloadCustomCssSetting() {
  if (!customCssPath.value) {
    message.value = "尚未选择自定义 CSS 文件";
    return;
  }
  settings.reloadCustomCss();
  message.value = "已重新加载自定义 CSS";
}

function onThemeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as ThemeSetting;
  settings.setTheme(value);
  message.value = "主题设置已更新";
}

function onFontSizeInput(event: Event) {
  settings.patch({ editorFontSize: Number((event.target as HTMLInputElement).value) });
}

function onAutoSaveInput(event: Event) {
  settings.patch({ autoSaveDelayMs: Number((event.target as HTMLInputElement).value) });
}

function onImageStrategyChange(event: Event) {
  settings.patch({ imageStrategy: (event.target as HTMLSelectElement).value as ImageStrategy });
  message.value = "图片策略已更新（对新插入图片生效）";
}

function close() {
  stopCapture();
  emit("close");
}

watch(capturing, (value) => {
  if (value) window.addEventListener("keydown", handleCapture, true);
  else window.removeEventListener("keydown", handleCapture, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleCapture, true);
});
</script>

<template>
  <div class="modal-backdrop" @click.self="close">
    <section class="shortcut-modal" role="dialog" aria-modal="true" aria-label="设置">
      <header class="modal-header">
        <div>
          <h2>设置与快捷键</h2>
          <p>修改后立即生效，配置会保存在本机。</p>
        </div>
        <button class="icon-btn" title="关闭" @click="close">×</button>
      </header>

      <div v-if="message" class="shortcut-message">{{ message }}</div>

      <div class="shortcut-groups">
        <section class="shortcut-group appearance-settings">
          <h3>外观与编辑</h3>
          <div class="settings-field">
            <div class="shortcut-command">
              <strong>主题</strong>
              <span>浅色 / 深色 / 跟随系统</span>
            </div>
            <select class="settings-select" :value="theme" @change="onThemeChange">
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
          <div class="settings-field">
            <div class="shortcut-command">
              <strong>正文字号</strong>
              <span>{{ editorFontSize }}px</span>
            </div>
            <input
              class="settings-range"
              type="range"
              min="12"
              max="28"
              step="1"
              :value="editorFontSize"
              @input="onFontSizeInput"
            />
          </div>
          <div class="settings-field">
            <div class="shortcut-command">
              <strong>自动保存延迟</strong>
              <span>{{ autoSaveDelayMs }}ms</span>
            </div>
            <input
              class="settings-range"
              type="range"
              min="300"
              max="10000"
              step="100"
              :value="autoSaveDelayMs"
              @input="onAutoSaveInput"
            />
          </div>
          <div class="settings-field">
            <div class="shortcut-command">
              <strong>图片本地化策略</strong>
              <span>粘贴/拖入图片时的落盘位置</span>
            </div>
            <select class="settings-select" :value="imageStrategy" @change="onImageStrategyChange">
              <option value="assets-subdir">assets 子目录（推荐）</option>
              <option value="relative">文档同级目录</option>
              <option value="absolute">绝对路径（不复制）</option>
            </select>
          </div>
          <div class="settings-field">
            <div class="shortcut-command">
              <strong>自定义 CSS</strong>
              <span>选择本机 CSS 文件后，会作用于编辑区和源码编辑区，配置保存在本机。</span>
            </div>
            <code class="settings-path" :title="customCssPath || '未选择'">{{ customCssPath || "未选择" }}</code>
            <button @click="chooseCustomCss">选择文件</button>
            <button @click="reloadCustomCssSetting">重新加载</button>
            <button @click="clearCustomCssSetting">清除</button>
          </div>
        </section>

        <section v-for="group in groupedCommands" :key="group.group" class="shortcut-group">
          <h3>{{ group.label }}</h3>
          <div class="shortcut-row" v-for="command in group.commands" :key="command.id">
            <div class="shortcut-command">
              <strong>{{ command.title }}</strong>
              <span v-if="command.description">{{ command.description }}</span>
            </div>
            <kbd :class="{ capturing: capturing === command.id }">
              {{ capturing === command.id ? "按下快捷键…" : displayShortcut(bindings[command.id]) }}
            </kbd>
            <button @click="startCapture(command.id)">修改</button>
            <button @click="resetCommand(command.id)">恢复默认</button>
          </div>
        </section>
      </div>

      <footer class="modal-actions">
        <button @click="resetAll">恢复全部默认快捷键</button>
        <button class="primary" @click="close">完成</button>
      </footer>
    </section>
  </div>
</template>
