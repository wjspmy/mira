# Mira

> 所见，即所得。A minimalist desktop Markdown WYSIWYG editor.

对标 [Typora](https://typora.io) 的桌面 Markdown 编辑器：本地优先、单用户、开源、轻量。
完整设计与路线图见 [docs/design.md](docs/design.md)。M2 修复与回归记录见 [docs/known-issues.md](docs/known-issues.md)。

## 功能

- 所见即所得编辑（Tiptap/ProseMirror），打字即渲染
- GFM：标题、粗/斜体、行内代码、有序/无序列表、任务列表、引用、表格、删除线、分隔线
- 代码块语法高亮（lowlight，37+ 种常用语言）
- 数学公式：行内 `$…$` 与块级 `$$…$$`（KaTeX，点击编辑原文）
- 浅色 / 深色 / 跟随系统主题（代码 token 双套配色）
- 丰富快捷键与本地自定义快捷键设置
- Typora 风格菜单栏、文件菜单最近打开、底部路径状态栏
- 格式工具栏（GitHub 风格）、GitHub Alerts（`[!NOTE]` 等）、任务列表、表格
- 文内查找（`Ctrl/Cmd+F`）与替换（`Ctrl/Cmd+H`），大纲侧栏，状态栏字数统计
- 命令面板与快速打开（命令、已打开文件、最近文件和工作区 Markdown 文件）
- 源码模式（CodeMirror 6，`Ctrl/Cmd+Shift+M`），与所见即所得共享同一文档；切换尽量保留光标/选区
- 大文件（≥200KB）自动使用源码模式（CodeMirror 虚拟滚动）；≥1MB 关闭语法高亮以保持流畅
- 自定义 CSS（作用域注入编辑区/源码区，文件变更自动热加载）
- 打开 / 保存 `.md`（原子写）、防抖自动保存（延迟可配）
- 设置：主题（浅/深/跟随系统）、正文字号、自动保存延迟、图片本地化策略、自定义 CSS
- 导出 HTML / PDF（打印）/ Word (.doc) / PNG；本地图片内联，文件外打开也能显示
- Markdown round-trip 无损（自研序列化器 + remark 归一）

## 技术栈

- **Tauri 2**（Rust 后端）+ **Vue 3** + **Vite** + **TypeScript**
- **Tiptap**（ProseMirror）WYSIWYG 内核 + **lowlight** 代码高亮 + **KaTeX** 数学
- **remark**（unified）做 Markdown 规范化归一
- **vitest** + jsdom 做 round-trip 测试
- **CodeMirror 6** 源码模式（兼作大文件退化路径）

## 开发

```bash
npm install
npm run tauri dev     # 启动开发模式（首次编译 Rust 约 2-3 分钟）
npm run tauri build   # 打包发布
npm test              # 跑 round-trip 测试
```

前提：Node.js、Rust（rustup）、Windows 需 WebView2 + MSVC 构建工具。

## 状态

**M0–M3 已完成，M4 核心项已完成，M5 导出（HTML/PDF）已交付**。

M4 已覆盖：设置（主题/字号/自动保存/图片策略）、大文件源码模式降级、自定义 CSS 热加载、回归测试扩充。

M5 已覆盖：导出 HTML、PDF（系统打印）、Word (.doc)、PNG。

发布向剩余：三端打包验证、自动更新签名、品牌图标、完整 E2E。

路线图：~~M0 脚手架~~ ✅ → ~~M1 核心~~ ✅ → ~~M2 文件管理~~ ✅ → ~~M3 生产力~~ ✅ → ~~M4 打磨（核心）~~ ✅ → ~~M5 导出（HTML/PDF）~~ ✅ → 发布收尾。

## License

MIT
