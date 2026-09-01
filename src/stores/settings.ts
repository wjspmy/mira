import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { normalizeNativePath } from "../utils/path";

const SETTINGS_KEY = "mira-settings";

export interface AppSettings {
  customCssPath: string;
  customCssVersion: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  customCssPath: "",
  customCssVersion: 0,
};

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const raw = value as Partial<AppSettings>;
  return {
    customCssPath: typeof raw.customCssPath === "string" ? normalizeNativePath(raw.customCssPath).trim() : "",
    customCssVersion: typeof raw.customCssVersion === "number" ? raw.customCssVersion : 0,
  };
}

function loadSettings(): AppSettings {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<AppSettings>(loadSettings());
  const customCssPath = computed(() => settings.value.customCssPath);
  const customCssVersion = computed(() => settings.value.customCssVersion);

  function persist() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value));
  }

  function setCustomCssPath(path: string) {
    settings.value = {
      ...settings.value,
      customCssPath: normalizeNativePath(path).trim(),
      customCssVersion: settings.value.customCssVersion + 1,
    };
    persist();
  }

  function clearCustomCssPath() {
    settings.value = {
      ...settings.value,
      customCssPath: "",
      customCssVersion: settings.value.customCssVersion + 1,
    };
    persist();
  }

  function reloadCustomCss() {
    settings.value = { ...settings.value, customCssVersion: settings.value.customCssVersion + 1 };
    persist();
  }

  return { settings, customCssPath, customCssVersion, setCustomCssPath, clearCustomCssPath, reloadCustomCss };
});
