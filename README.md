# Mira

> 所见，即所得。A minimalist desktop Markdown WYSIWYG editor.

对标 [Typora](https://typora.io) 的桌面 Markdown 编辑器：本地优先、单用户、开源、轻量。
完整设计与路线图见 [docs/design.md](docs/design.md)。已知未解决问题见 [docs/known-issues.md](docs/known-issues.md)。

## 功能

- 所见即所得编辑（Tiptap/ProseMirror），打字即渲染
- GFM：标题、粗/斜体、行内代码、有序/无序列表、任务列表、引用、表格、删除线、分隔线
- 代码块语法高亮（lowlight，37+ 种常用语言）
- 数学公式：行内 `$…$` 与块级 `$$…$$`（KaTeX，点击编辑原文）
- 浅色 / 深色 / 跟随系统主题（代码 token 双套配色）
- 打开 / 保存 `.md`（原子写）、防抖自动保存
- Markdown round-trip 无损（自研序列化器 + remark 归一，18/18 测试用例）

## 技术栈

- **Tauri 2**（Rust 后端）+ **Vue 3** + **Vite** + **TypeScript**
- **Tiptap**（ProseMirror）WYSIWYG 内核 + **lowlight** 代码高亮 + **KaTeX** 数学
- **remark**（unified）做 Markdown 规范化归一
- **vitest** + jsdom 做 round-trip 测试
- 规划中：CodeMirror 6 源码模式（M3）

## 开发

```bash
npm install
npm run tauri dev     # 启动开发模式（首次编译 Rust 约 2-3 分钟）
npm run tauri build   # 打包发布
npm test              # 跑 round-trip 测试
```

前提：Node.js、Rust（rustup）、Windows 需 WebView2 + MSVC 构建工具。

## 状态

**M0 + M1 已完成，M2 文件管理进行中**：已具备日常写作与基础工作区体验。

路线图：~~M0 脚手架~~ ✅ → ~~M1 核心~~ ✅ → M2 文件管理（进行中）→ M3 生产力 → M4 打磨发布 → M5 导出。

## License

MIT
