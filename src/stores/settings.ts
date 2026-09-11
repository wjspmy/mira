import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { normalizeNativePath } from "../utils/path";

const SETTINGS_KEY = "mira-settings";
const LEGACY_THEME_KEY = "mira-theme";

export type ThemeSetting = "light" | "dark" | "system";
export type ImageStrategy = "assets-subdir" | "relative" | "absolute";

export interface AppSettings {
  theme: ThemeSetting;
  editorFontSize: number;
  editorFontFamily: string;
  autoSaveDelayMs: number;
  imageStrategy: ImageStrategy;
  customCssPath: string;
  customCssVersion: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  editorFontSize: 16,
  editorFontFamily: "",
  autoSaveDelayMs: 1000,
  imageStrategy: "assets-subdir",
  customCssPath: "",
  customCssVersion: 0,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeTheme(value: unknown): ThemeSetting {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_SETTINGS.theme;
}

function normalizeImageStrategy(value: unknown): ImageStrategy {
  return value === "assets-subdir" || value === "relative" || value === "absolute"
    ? value
    : DEFAULT_SETTINGS.imageStrategy;
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const raw = value as Partial<AppSettings>;
  return {
    theme: normalizeTheme(raw.theme),
    editorFontSize: clampInt(raw.editorFontSize, 12, 28, DEFAULT_SETTINGS.editorFontSize),
    editorFontFamily: typeof raw.editorFontFamily === "string" ? raw.editorFontFamily.trim() : "",
    autoSaveDelayMs: clampInt(raw.autoSaveDelayMs, 300, 30000, DEFAULT_SETTINGS.autoSaveDelayMs),
    imageStrategy: normalizeImageStrategy(raw.imageStrategy),
    customCssPath: typeof raw.customCssPath === "string" ? normalizeNativePath(raw.customCssPath).trim() : "",
    customCssVersion: typeof raw.customCssVersion === "number" ? raw.customCssVersion : 0,
  };
}

function loadSettings(): AppSettings {
  try {
    const base = normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
    if (!base.theme || base.theme === "system") {
      const legacy = localStorage.getItem(LEGACY_THEME_KEY);
      if (legacy === "light" || legacy === "dark") base.theme = legacy;
    }
    return base;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<AppSettings>(loadSettings());
  const theme = computed(() => settings.value.theme);
  const editorFontSize = computed(() => settings.value.editorFontSize);
  const editorFontFamily = computed(() => settings.value.editorFontFamily);
  const autoSaveDelayMs = computed(() => settings.value.autoSaveDelayMs);
  const imageStrategy = computed(() => settings.value.imageStrategy);
  const customCssPath = computed(() => settings.value.customCssPath);
  const customCssVersion = computed(() => settings.value.customCssVersion);

  function persist() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value));
  }

  function patch(partial: Partial<AppSettings>) {
    settings.value = normalizeSettings({ ...settings.value, ...partial });
    persist();
  }

  function setTheme(themeValue: ThemeSetting) {
    patch({ theme: themeValue });
    if (themeValue === "light" || themeValue === "dark") {
      localStorage.setItem(LEGACY_THEME_KEY, themeValue);
    } else {
      localStorage.removeItem(LEGACY_THEME_KEY);
    }
  }

  function resolveTheme(systemDark: boolean): "light" | "dark" {
    if (settings.value.theme === "system") return systemDark ? "dark" : "light";
    return settings.value.theme;
  }

  function setCustomCssPath(path: string) {
    patch({ customCssPath: normalizeNativePath(path).trim(), customCssVersion: settings.value.customCssVersion + 1 });
  }

  function clearCustomCssPath() {
    patch({ customCssPath: "", customCssVersion: settings.value.customCssVersion + 1 });
  }

  function reloadCustomCss() {
    patch({ customCssVersion: settings.value.customCssVersion + 1 });
  }

  return {
    settings,
    theme,
    editorFontSize,
    editorFontFamily,
    autoSaveDelayMs,
    imageStrategy,
    customCssPath,
    customCssVersion,
    patch,
    setTheme,
    resolveTheme,
    setCustomCssPath,
    clearCustomCssPath,
    reloadCustomCss,
  };
});
