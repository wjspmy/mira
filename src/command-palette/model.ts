import type { ShortcutCommand, ShortcutCommandId } from "../shortcuts/registry";
import { basename } from "../utils/path";

export type PaletteEntryKind = "command" | "file";

export interface PaletteEntry {
  key: string;
  kind: PaletteEntryKind;
  title: string;
  subtitle?: string;
  shortcut?: string;
  commandId?: ShortcutCommandId;
  path?: string;
}

export interface PaletteSource {
  commands: ShortcutCommand[];
  shortcuts: Partial<Record<ShortcutCommandId, string>>;
  openPaths: string[];
  recentPaths: string[];
  workspacePaths: string[];
}

const HIDDEN_COMMANDS = new Set<ShortcutCommandId>([
  "nextTab",
  "prevTab",
  "tab1",
  "tab2",
  "tab3",
  "tab4",
  "tab5",
  "tab6",
  "tab7",
  "tab8",
  "tab9",
  "openCommandPalette",
]);

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function pathKey(path: string): string {
  return path.replace(/\\/g, "/").toLocaleLowerCase();
}

function commandEntries(source: PaletteSource): PaletteEntry[] {
  return source.commands
    .filter((command) => !HIDDEN_COMMANDS.has(command.id))
    .map((command) => ({
      key: "command:" + command.id,
      kind: "command" as const,
      title: command.title,
      subtitle: command.group === "file" ? "文件" : command.group === "edit" ? "编辑" : command.group === "tabs" ? "标签页" : "应用",
      shortcut: source.shortcuts[command.id],
      commandId: command.id,
    }));
}

function fileEntries(source: PaletteSource): PaletteEntry[] {
  const files = new Map<string, PaletteEntry>();
  const add = (paths: string[], sourceLabel: string) => {
    for (const path of paths) {
      if (!path) continue;
      const key = pathKey(path);
      if (files.has(key)) continue;
      files.set(key, {
        key: "file:" + key,
        kind: "file",
        title: basename(path),
        subtitle: sourceLabel + " · " + path,
        path,
      });
    }
  };
  add(source.openPaths, "已打开");
  add(source.recentPaths, "最近");
  add(source.workspacePaths, "工作区");
  return [...files.values()];
}

export function buildPaletteEntries(source: PaletteSource): PaletteEntry[] {
  return [...commandEntries(source), ...fileEntries(source)];
}

function matchScore(entry: PaletteEntry, query: string): number | null {
  if (!query) return entry.kind === "command" ? 0 : 3;
  const title = normalized(entry.title);
  const subtitle = normalized(entry.subtitle || "");
  const commandId = normalized(entry.commandId || "");
  if (title.startsWith(query)) return 0;
  if (commandId.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (subtitle.includes(query) || commandId.includes(query)) return 3;
  return null;
}

export function searchPaletteEntries(entries: PaletteEntry[], query: string, limit = 80): PaletteEntry[] {
  const needle = normalized(query);
  return entries
    .map((entry) => ({ entry, score: matchScore(entry, needle) }))
    .filter((candidate): candidate is { entry: PaletteEntry; score: number } => candidate.score !== null)
    .sort((left, right) =>
      (left.entry.kind === right.entry.kind ? 0 : left.entry.kind === "command" ? -1 : 1)
      || left.score - right.score
      || left.entry.title.localeCompare(right.entry.title, "zh-CN"),
    )
    .slice(0, limit)
    .map((candidate) => candidate.entry);
}
