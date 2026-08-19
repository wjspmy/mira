# Command Palette Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a unified command palette that executes application commands and quickly opens Markdown files from the current workspace, recent files, and open tabs.

**Architecture:** Reuse the existing shortcut registry for command entries and add a bounded Tauri workspace-file index for file entries. The Vue palette owns filtering, keyboard navigation, and display; App.vue owns command execution and file opening.

**Tech Stack:** Vue 3, Pinia, Tauri 2/Rust, TypeScript, Vitest.

---

## Product Decisions

- 默认快捷键：Mod+Shift+P；Windows/Linux 显示为 Ctrl+Shift+P。
- 面板同时搜索命令、已打开标签、最近文件和当前工作区内的 Markdown 文件。
- 文件搜索只匹配 .md、.markdown、.mdx、.txt；后端递归索引上限 2,000 个文件，跳过 .git、node_modules、target、dist、.vite 与隐藏目录。
- 搜索排序：前缀匹配优先，其次子串匹配；命令结果优先于文件结果。
- 键盘：上下箭头切换、Enter 执行、Escape 关闭；打开时输入框自动聚焦。
- 第一版不做模糊拼音、不做最近命令排序、不做全盘搜索。

---

### Task 12.1: Add Command Palette Shortcut and Menu Entry

**Files:**

- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\shortcuts\registry.ts
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\menus\appMenu.ts
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\App.vue

**Steps:**

1. Add openCommandPalette to ShortcutCommandId with default Mod+Shift+P.
2. Add “命令面板” under the 工具 menu and show its live shortcut label.
3. Add App state to open/close the palette and route the shortcut command to it.

**Verification:**

- Ctrl+Shift+P opens the palette on Windows.
- 工具菜单可打开命令面板。
- 自定义快捷键后菜单显示同步更新。

---

### Task 12.2: Add Bounded Workspace Markdown File Index

**Files:**

- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src-tauri\src\lib.rs
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\stores\workspace.ts

**Steps:**

1. Add Tauri command list_workspace_files(root, max_results).
2. Validate root with existing allow-path sandbox checks.
3. Recursively scan allowed workspace folders, skip ignored/hidden folders, and return Markdown/text file paths only.
4. Cap results at 2,000 files.
5. Expose listSearchableFiles() from the workspace store.

**Verification:**

- File results stay inside the allowed workspace root.
- Hidden/ignored folders do not appear.
- Only supported text/Markdown files are returned.

---

### Task 12.3: Create Palette Model and Vue Component

**Files:**

- Create: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\command-palette\model.ts
- Create: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\components\CommandPalette.vue
- Create: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\test\command-palette.test.ts

**Steps:**

1. Build normalized palette entries for commands and file paths.
2. Add deterministic search/ranking: prefix match before substring match.
3. Render grouped command/file results, with active selection and empty/loading states.
4. Emit run-command and open-file to App.vue.
5. Support ArrowUp/ArrowDown/Enter/Escape and input autofocus.

**Verification:**

- Search finds 保存 and saveFile.
- Search finds a file by filename and path fragment.
- Arrow keys and Enter activate the highlighted result.
- Escape closes without executing.

---

### Task 12.4: Integrate, Document, and Verify

**Files:**

- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\App.vue
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\styles\editor.css
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\README.md
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\docs\design.md

**Checks:**

1. Run npm.cmd test.
2. Run npm.cmd run build.
3. Run cargo check in src-tauri if the Rust toolchain is available.
4. Manual test: command search, recent/open/workspace file search, custom shortcut, keyboard navigation, empty/loading/error behavior.
5. Commit and push only after user verification.

---

## Implementation Status

- [x] Added the configurable `Mod+Shift+P` command-palette shortcut and Tools menu entry.
- [x] Added a bounded, sandboxed workspace file index for Markdown and text files.
- [x] Added command/file ranking, keyboard navigation, and the command-palette UI.
- [x] Integrated command execution and file opening into `App.vue`.
- [x] Updated README and design documentation.
- [x] Automated verification passed for `npm.cmd run build`, `cargo check`, `git diff --check`, and `vitest run test/command-palette.test.ts --environment node`.
- [ ] Full `npm.cmd test` is currently blocked by the local jsdom/html-encoding-sniffer ESM/CJS environment issue; no business assertion failed in the focused command-palette test.
- [ ] User manual testing.
- [ ] UX adjusted so the palette delays workspace indexing until the user types at least 2 characters and pauses briefly, keeping first input responsive.
- [ ] Commit and push after user acceptance.
