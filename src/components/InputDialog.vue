<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    label?: string;
    placeholder?: string;
    initialValue?: string;
    confirmLabel?: string;
    /** 返回错误消息或 null */
    validate?: (value: string) => string | null;
  }>(),
  {
    label: "",
    placeholder: "",
    initialValue: "",
    confirmLabel: "确定",
  },
);

const emit = defineEmits<{
  submit: [value: string];
  cancel: [];
}>();

const input = ref<HTMLInputElement | null>(null);
const value = ref(props.initialValue);
const error = ref("");

const canConfirm = computed(() => value.value.trim().length > 0);

function submit() {
  const v = value.value.trim();
  if (!v) {
    error.value = "不能为空";
    return;
  }
  if (props.validate) {
    const msg = props.validate(v);
    if (msg) {
      error.value = msg;
      return;
    }
  }
  emit("submit", v);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    submit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    emit("cancel");
  }
}

onMounted(() => {
  void nextTick(() => {
    input.value?.focus();
    input.value?.select();
  });
});
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('cancel')" @keydown="onKeydown">
    <section class="input-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <header class="modal-header">
        <h2>{{ title }}</h2>
        <button type="button" class="icon-btn" title="关闭" @click="emit('cancel')">×</button>
      </header>
      <div class="input-dialog-body">
        <label v-if="label" class="input-dialog-label">{{ label }}</label>
        <input
          ref="input"
          v-model="value"
          class="find-input"
          type="text"
          :placeholder="placeholder"
          spellcheck="false"
          @input="error = ''"
        />
        <p v-if="error" class="input-dialog-error">{{ error }}</p>
      </div>
      <footer class="modal-actions">
        <button type="button" @click="emit('cancel')">取消</button>
        <button type="button" class="primary" :disabled="!canConfirm" @click="submit">
          {{ confirmLabel }}
        </button>
      </footer>
    </section>
  </div>
</template>
