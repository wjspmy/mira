---
feature: mira-product-gaps
status: delivered
updated: 2026-09-12
branch: main
commits: # fill at delivery
---

# Mira 产品功能与设计评估 → 下一轮改进

## Report

**What was built** — 应用内 InputDialog 替换 prompt/alert；图片选中面板（alt/删除）；Design Tokens（品牌紫/间距/圆角）；成功 Toast；工具栏 aria-label 与 focus-visible；已命名 dirty 文档的自动保存倒计时。

**Verification** — `npm test` 80/80 PASS；`npm run build` PASS。

**Journey log** — 未命名文档仍无自动落盘；图片「更换」仍走路径对话框。

## [S1] Problem

Mira 功能面已接近「小 Typora」，产品体验仍偏工程堆叠。基于代码证据（`src/App.vue`、`src/editor/image.ts`、`src/menus/appMenu.ts`、`editor.css`、组件与 80 项测试）的优先问题：

| 优先级 | 问题 | 证据 |
|--------|------|------|
| P0 | 图片插入靠 `window.prompt`，无选中编辑面板 | `App.vue` `insertImageFromDialog` |
| P0 | 文件夹/链接/图片仍用 `window.prompt` / `window.alert` | 新建/重命名/移动、insertLink |
| P0 | 无 Design Tokens；品牌紫仅欢迎屏 M 标，编辑器 accent 仍是蓝 `#2563eb` | `editor.css` |
| P1 | 成功路径（打开/保存/导出）只有 status 文案，无 success Toast | App.vue open/save/export |
| P1 | 工具栏标题下拉/右侧工具/更多菜单缺 focus-visible；部分 icon 无 aria-label | EditorToolbar.vue |
| P1 | 未命名文档永不自动保存（`scheduleAutosave` 要求 `filePath`） | App.vue |
| P2 | 中英混杂状态文案（External move synced 等） | App.vue |

证据边界：本会话无法对 Tauri 运行窗口截屏；不声称像素级或完整 a11y 合规。

## [S2] Design

### 原则

- 极简、本地优先；不做插件市场/协作/双栏预览。
- 高频一键可达；失败可行动；成功轻提示。

### 合同：原生对话框替换（P0）

- 新建文件夹、重命名、移动目标、插入链接、插入图片：改为应用内小型 Modal（或统一 Dialog 组件）。
- 表单校验：空名、非法字符、路径冲突；取消不改状态。
- 完成后 Toast success + 文件树刷新。

### 合同：图片面板（P0，本轮不做宽度）

- 选中 `image` 节点显示面板：`src` 展示 +「更换…」、`alt` 输入、「删除」。
- **宽度不在本轮**：CommonMark/`imageMd` 无 width；若要做需 HTML 输出或自定义序列化，另开规格。
- 未保存文档更换本地图片：提示先保存，不静默失败。

### 合同：Design Tokens（P0）

- 增加 `--brand` `#6b21a8`、`--brand-deep` `#1e1b4b`、`--space-*`、`--radius-*`。
- 欢迎屏 M 标、工具栏 **active**（可改为品牌色或保留蓝 accent，二选一写死）、设置 tab active 共用 token。
- **success Toast 保持语义绿**，不强制改品牌紫。

### 合同：反馈（P1）

- 打开/保存/导出成功：`showToast(..., "success")`。
- 统一失败前缀与中文文案；去掉英文 status 残留。
- 自动保存倒计时：**仅** `filePath && dirty` 时显示；未命名文档只走草稿逻辑。

### 合同：无障碍（P1）

- 标题下拉、大纲/源码/更多按钮补 `aria-label`。
- 全部 toolbar/menu 弹层按钮 `:focus-visible` 焦点环。

## [S3] Out of Scope

- Tiptap 3 升级、链接 title/表格对齐解析根治。
- 图片宽度 %、图片缩放手柄。
- mac/Linux 打包、自动更新、WebDriver E2E。
- 未命名文档自动落盘策略（仅文档化行为）。

## Tasks

- [x] T1: Dialog 组件替换 prompt/alert
- [x] T2: 图片选中面板 src/alt/删除
- [x] T3: Design tokens + chrome 接入
- [x] T4: 成功 Toast
- [x] T5: toolbar aria-label + focus-visible
- [x] T6: 自动保存倒计时（已命名 dirty）
