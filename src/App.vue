<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";

// M0：用 tiptap-markdown 做最小可用互转；
// TODO(M1)：按设计 §14.3 换成 remark + 自研序列化器，保证 round-trip 等价。
// TODO(M2)：把 read/write 换成 §16 的自定义 fs commands（编码探测 / 原子写 / 沙箱）。

const filePath = ref<string | null>(null);
const dirty = ref(false);
const status = ref("就绪");

const lowlight = createLowlight(common);

const editor = useEditor({
  extensions: [
    StarterKit.configure({ codeBlock: false }),
    CodeBlockLowlight.configure({ lowlight }),
    Markdown.configure({ html: false, breaks: true }),
  ],
  content: "# 新文档\n\n开始写作…",
  onUpdate: () => {
    dirty.value = true;
    scheduleAutosave();
  },
});

function getMarkdown(): string {
  // tiptap-markdown 注入的 storage，方法名为 getMarkdown()（不是 get()）
  const md = (editor.value?.storage as any).markdown;
  return md?.getMarkdown?.() ?? "";
}

async function openFile() {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
  });
  if (!selected) return;
  const path = typeof selected === "string" ? selected : (selected as any).path;
  if (!path) return;
  try {
    const text = await invoke<string>("read_text_file", { path });
    filePath.value = path;
    editor.value?.commands.setContent(text);
    dirty.value = false;
    status.value = `已打开 ${path}`;
  } catch (e) {
    status.value = `打开失败：${e}`;
  }
}

async function saveFile() {
  const md = getMarkdown();
  let path = filePath.value;
  if (!path) {
    path = await saveDialog({
      defaultPath: "untitled.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!path) return;
    filePath.value = path;
  }
  try {
    await invoke("write_text_file", { path, content: md });
    dirty.value = false;
    status.value = `已保存 ${path}`;
  } catch (e) {
    status.value = `保存失败：${e}`;
  }
}

// 防抖自动保存（仅对已命名文档）
let timer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutosave() {
  if (!filePath.value) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      await invoke("write_text_file", { path: filePath.value, content: getMarkdown() });
      dirty.value = false;
      status.value = `已自动保存 ${filePath.value}`;
    } catch (e) {
      status.value = `自动保存失败：${e}`;
    }
  }, 1000);
}

watch(dirty, (v) => {
  const name = filePath.value ?? "未命名";
  document.title = v ? `Mira — ${name} •` : `Mira — ${name}`;
});

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
  editor.value?.destroy();
});
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <button @click="openFile">打开</button>
      <button @click="saveFile">保存</button>
      <span class="path">{{ filePath ?? "未命名" }}</span>
      <span class="dot" :class="{ dirty }">{{ dirty ? "● 未保存" : "已保存" }}</span>
    </header>
    <EditorContent v-if="editor" :editor="editor" class="mira-editor editor" />
    <footer class="status">{{ status }}</footer>
  </div>
</template>
