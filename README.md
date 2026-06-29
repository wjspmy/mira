# Mira

> 所见，即所得。A minimalist desktop Markdown WYSIWYG editor.

对标 [Typora](https://typora.io) 的桌面 Markdown 编辑器：本地优先、单用户、开源、轻量。
完整设计与路线图见 [docs/design.md](docs/design.md)。

## 技术栈

- **Tauri 2**（Rust 后端）+ **Vue 3** + **Vite** + **TypeScript**
- **Tiptap**（ProseMirror）所见即所得编辑内核
- CodeMirror 6 源码模式（规划中，M3）

## 开发

```bash
npm install
npm run tauri dev     # 启动开发模式（首次编译 Rust 约 2-3 分钟）
npm run tauri build   # 打包发布
```

前提：Node.js、Rust（rustup）、Windows 需 WebView2 + MSVC 构建工具。

## 状态

**M0**：可打开 / 编辑 / 保存单个 `.md` 文件，所见即所得渲染。
路线图：M0 脚手架 → M1 核心 → M2 文件管理 → M3 生产力 → M4 打磨发布 → M5 导出。

## License

MIT
