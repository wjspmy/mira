# Typora Menu and Status Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the crowded top toolbar with a Typora-like application menu, move the current file path to the bottom status bar, and place “最近打开” under the File menu.

**Architecture:** Keep the implementation in Vue so it can reuse the current command and shortcut registry from Task 10. Extract menu UI into a small component, keep command execution in App.vue, and let the bottom status bar receive derived display state from the active document.

**Tech Stack:** Vue 3, Pinia, Tauri 2, TypeScript, CSS, Vitest.

---

## Product Decisions

- 顶部不再堆放“打开文件夹 / 打开 / 新建 / 保存 / 主题 / 快捷键”等按钮，改为桌面编辑器菜单栏。
- 菜单分组采用：文件、编辑、格式、视图、工具、帮助。
- 最近打开收入文件菜单，作为文件入口的一部分；左侧栏后续只保留工作区文件树。
- 当前文件完整路径从顶部移动到底部状态栏。
- 底部状态栏分为：左侧状态消息、中间当前文件路径、右侧保存状态。
- 菜单项右侧显示当前快捷键，使用 Task 10 的快捷键 registry / store。
- 第一版使用 Web 菜单，不做 Tauri 原生菜单，降低跨平台和 Rust 侧改动风险。

---

## Task 11.1: Create Web Menu Bar Component

**Files:**

- Create: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\components\AppMenuBar.vue
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\App.vue
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\styles\editor.css

**Steps:**

1. Create AppMenuBar.vue with menu groups: 文件、编辑、格式、视图、工具、帮助。
2. Define menu item props: id, label, shortcut, disabled, danger, separatorBefore。
3. Emit run-command with command id when a menu item is clicked。
4. Add mouse click open/close behavior。
5. Add click-outside and Esc close behavior。
6. Style the menu to feel close to Typora: compact top row, flat text buttons, light dropdown shadows, clear hover/focus states。

**Verification:**

- App starts without visual overflow。
- Clicking each menu header opens a dropdown。
- Clicking outside closes the dropdown。
- Pressing Esc closes the dropdown。

---

## Task 11.2: Move Current Toolbar Actions into Menus

**Files:**

- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\App.vue
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\shortcuts\registry.ts
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\components\AppMenuBar.vue

**Menu mapping:**

### 文件

- 新建
- 打开文件
- 打开文件夹
- 保存
- 关闭标签
- 最近打开

### 编辑

- 撤销（如果当前编辑器命令可用）
- 重做（如果当前编辑器命令可用）

### 格式

- 加粗
- 斜体
- 行内代码
- 插入链接
- 无序列表
- 有序列表
- 引用
- 代码块

### 视图

- 切换主题
- 切换侧边栏（可后续补，不阻塞第一版）

### 工具

- 快捷键设置

### 帮助

- 关于 Mira（可先占位或禁用）

**Verification:**

- 原顶部按钮能做的事，在菜单里都能完成。
- 菜单项显示和自定义快捷键一致的快捷键文本。
- 禁用态正确，例如没有活动文档时保存/关闭不可用。

---

## Task 11.3: Move Recent Open into File Menu

**Files:**

- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\App.vue
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\components\AppMenuBar.vue
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\stores\recent.ts

**Steps:**

1. Pass recent files from useRecentStore() into AppMenuBar.vue。
2. Render them under 文件 > 最近打开。
3. Show basename as primary label and full path as tooltip。
4. Clicking a recent file calls existing openFile(path)。
5. If a recent file fails to open, keep the existing cleanup behavior: remove invalid recent path and show status message。
6. Remove or collapse the current left sidebar “最近打开” block after menu version works。

**Verification:**

- Recent files appear under 文件 > 最近打开。
- Clicking an item opens the file。
- Missing recent files are removed after open failure。
- Left sidebar no longer duplicates recent-open content。

---

## Task 11.4: Rebuild Bottom Status Bar

**Files:**

- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\App.vue
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\src\styles\editor.css

**Layout:**

    左侧：状态消息        中间：当前文件完整路径        右侧：已保存 / ● 未保存

**Steps:**

1. Remove current file path display from the top toolbar area。
2. Move current path into the footer status bar。
3. Keep 未命名 for untitled documents。
4. Use ellipsis for long paths。
5. Add title attribute so hover shows the full path。
6. Keep dirty state visually obvious on the right side。

**Verification:**

- Long Windows paths no longer crowd the top bar。
- Bottom path displays correctly for named files。
- Untitled tabs show 未命名。
- Dirty / saved status remains visible。

---

## Task 11.5: Tests and Regression

**Files:**

- Modify or create tests under: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\test
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\README.md
- Modify: C:\Users\Administrator.DESKTOP-GE3BNNM\mira\docs\design.md

**Checks:**

1. Run: npm.cmd test

Expected: all tests pass。

2. Run: npm.cmd run build

Expected: TypeScript and Vite build pass。

3. Manual test:
   - 菜单打开/关闭
   - 文件菜单新建/打开/保存/关闭
   - 文件菜单最近打开
   - 格式菜单编辑命令
   - 工具菜单快捷键设置
   - 底部状态栏路径和保存状态

**Commit after user approval only:**

    git add src/App.vue src/components/AppMenuBar.vue src/styles/editor.css src/shortcuts/registry.ts test README.md docs/design.md docs/plans/2026-08-15-typora-menu-statusbar.md
    git commit -m "Add Typora-style menu plan and layout"
