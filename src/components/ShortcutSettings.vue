<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { storeToRefs } from "pinia";
import { SHORTCUT_COMMANDS, SHORTCUT_COMMAND_BY_ID, SHORTCUT_GROUP_LABELS, type ShortcutCommand, type ShortcutCommandId, type ShortcutGroup } from "../shortcuts/registry";
import { displayShortcut, shortcutFromEvent } from "../shortcuts/keyboard";
import { useShortcutsStore } from "../stores/shortcuts";
import { useSettingsStore, type ImageStrategy, type ThemeSetting } from "../stores/settings";

const emit = defineEmits<{
  close: [];
  feedback: [payload: { message: string; kind: "info" | "success" | "warn" | "error" }];
}>();
const shortcuts = useShortcutsStore();
const settings = useSettingsStore();
const { bindings } = storeToRefs(shortcuts);
const { customCssPath, theme, editorFontSize, autoSaveDelayMs, imageStrategy, slashCommandsEnabled, singleInstanceEnabled } = storeToRefs(settings);
const capturing = ref<ShortcutCommandId | null>(null);
const message = ref("");
let messageTimer: ReturnType<typeof setTimeout> | null = null;
const activeTab = ref<"appearance" | "editor" | "shortcuts">("appearance");

const NAV_ITEMS: Array<{ id: "appearance" | "editor" | "shortcuts"; label: string; hint: string }> = [
  { id: "appearance", label: "外观", hint: "主题、字号、CSS" },
  { id: "editor", label: "编辑", hint: "自动保存、斜杠命令、图片" },
  { id: "shortcuts", label: "快捷键", hint: "全部命令绑定" },
];

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

function setMessage(text: string) {
  emit("feedback", { message: text, kind: "info" });
}

function switchTab(tab: typeof activeTab.value) {
  activeTab.value = tab;
  stopCapture();
  message.value = "";
  if (messageTimer) clearTimeout(messageTimer);
}

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
  setMessage(`已恢复「${SHORTCUT_COMMAND_BY_ID[commandId].title}」默认快捷键`);
}

function resetAll() {
  shortcuts.resetAll();
  setMessage("已恢复全部默认快捷键");
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
  setMessage("已选择自定义 CSS");
}

function clearCustomCssSetting() {
  settings.clearCustomCssPath();
  setMessage("已清除自定义 CSS");
}

function reloadCustomCssSetting() {
  if (!customCssPath.value) {
    setMessage("尚未选择自定义 CSS 文件");
    return;
  }
  settings.reloadCustomCss();
  setMessage("已重新加载自定义 CSS");
}

function onThemeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as ThemeSetting;
  settings.setTheme(value);
  setMessage("主题已更新");
}

function onFontSizeInput(event: Event) {
  settings.patch({ editorFontSize: Number((event.target as HTMLInputElement).value) });
}

function onAutoSaveInput(event: Event) {
  settings.patch({ autoSaveDelayMs: Number((event.target as HTMLInputElement).value) });
}

function onImageStrategyChange(event: Event) {
  settings.patch({ imageStrategy: (event.target as HTMLSelectElement).value as ImageStrategy });
  setMessage("图片策略已更新");
}

async function onSingleInstanceChange(event: Event) {
  const on = (event.target as HTMLInputElement).checked;
  settings.patch({ singleInstanceEnabled: on });
  try {
    await invoke("set_single_instance_pref", { enabled: on });
    setMessage(on ? "已开启单实例（重启后生效）" : "已关闭单实例（重启后生效）");
  } catch {
    setMessage("写入系统配置失败");
  }
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
    <section class="shortcut-modal settings-modal" role="dialog" aria-modal="true" aria-label="设置">
      <header class="modal-header">
        <div>
          <h2>设置</h2>
        </div>
        <button type="button" class="icon-btn" title="关闭" @click="close">×</button>
      </header>

      <div class="settings-layout">
        <nav class="settings-nav" role="tablist" aria-orientation="vertical">
          <button
            v-for="item in NAV_ITEMS"
            :key="item.id"
            type="button"
            role="tab"
            class="settings-nav-item"
            :class="{ active: activeTab === item.id }"
            :aria-selected="activeTab === item.id"
            @click="switchTab(item.id)"
          >
            <span class="settings-nav-label">{{ item.label }}</span>
            <span class="settings-nav-hint">{{ item.hint }}</span>
          </button>
        </nav>

        <div class="settings-body">
          <div v-if="activeTab === 'appearance'" class="shortcut-groups">
            <section class="shortcut-group">
              <h3>主题</h3>
              <div class="settings-field">
                <div class="shortcut-command">
                  <strong>外观模式</strong>
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
            </section>
            <section class="shortcut-group">
              <h3>自定义 CSS</h3>
              <div class="settings-field">
                <div class="shortcut-command">
                  <strong>样式文件</strong>
                  <span>作用于编辑区和源码区，文件变更会热加载。</span>
                </div>
                <code class="settings-path" :title="customCssPath || '未选择'">{{ customCssPath || "未选择" }}</code>
                <button type="button" @click="chooseCustomCss">选择文件</button>
                <button type="button" @click="reloadCustomCssSetting">重新加载</button>
                <button type="button" @click="clearCustomCssSetting">清除</button>
              </div>
            </section>
          </div>

          <div v-else-if="activeTab === 'editor'" class="shortcut-groups">
            <section class="shortcut-group">
              <h3>编辑行为</h3>
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
                  <strong>斜杠命令</strong>
                  <span>空段输入 / 弹出插入菜单</span>
                </div>
                <label class="settings-check">
                  <input
                    type="checkbox"
                    :checked="slashCommandsEnabled"
                    @change="settings.patch({ slashCommandsEnabled: ($event.target as HTMLInputElement).checked })"
                  />
                  启用
                </label>
              </div>
              <div class="settings-field">
                <div class="shortcut-command">
                  <strong>单实例模式</strong>
                  <span>已运行时再启动只聚焦原窗口（重启后生效）</span>
                </div>
                <label class="settings-check">
                  <input
                    type="checkbox"
                    :checked="singleInstanceEnabled"
                    @change="onSingleInstanceChange"
                  />
                  启用
                </label>
              </div>
              <div class="settings-field">
                <div class="shortcut-command">
                  <strong>图片本地化策略</strong>
                  <span>粘贴 / 拖入图片时的落盘位置</span>
                </div>
                <select class="settings-select" :value="imageStrategy" @change="onImageStrategyChange">
                  <option value="assets-subdir">assets 子目录（推荐）</option>
                  <option value="relative">文档同级目录</option>
                  <option value="absolute">绝对路径（不复制）</option>
                </select>
              </div>
            </section>
          </div>

          <div v-else class="shortcut-groups">
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
                <button type="button" @click="startCapture(command.id)">修改</button>
                <button type="button" @click="resetCommand(command.id)">恢复默认</button>
              </div>
            </section>
          </div>
        </div>
      </div>

      <footer class="modal-actions">
        <button v-if="activeTab === 'shortcuts'" type="button" @click="resetAll">恢复全部默认快捷键</button>
        <button type="button" class="primary" @click="close">完成</button>
      </footer>
    </section>
  </div>
</template>
