<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { SHORTCUT_COMMANDS, SHORTCUT_COMMAND_BY_ID, SHORTCUT_GROUP_LABELS, type ShortcutCommand, type ShortcutCommandId, type ShortcutGroup } from "../shortcuts/registry";
import { displayShortcut, shortcutFromEvent } from "../shortcuts/keyboard";
import { useShortcutsStore } from "../stores/shortcuts";

const emit = defineEmits<{ (e: "close"): void }>();
const shortcuts = useShortcutsStore();
const { bindings } = storeToRefs(shortcuts);
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
    <section class="shortcut-modal" role="dialog" aria-modal="true" aria-label="快捷键设置">
      <header class="modal-header">
        <div>
          <h2>快捷键设置</h2>
          <p>修改后立即生效，配置会保存在本机。</p>
        </div>
        <button class="icon-btn" title="关闭" @click="close">×</button>
      </header>

      <div v-if="message" class="shortcut-message">{{ message }}</div>

      <div class="shortcut-groups">
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
        <button @click="resetAll">恢复全部默认</button>
        <button class="primary" @click="close">完成</button>
      </footer>
    </section>
  </div>
</template>
