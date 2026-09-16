# Mira

> 所见，即所得。本地优先的桌面 Markdown 编辑器。

对标 Typora 的极简 WYSIWYG 编辑器：单用户、开源、轻量。技术说明见 [docs/design.md](docs/design.md)。

![icon](docs/icon-mira.png)

## 下载

到 [Releases](https://github.com/wjspmy/mira/releases) 获取 Windows 安装包。当前仅提供 Windows x64。

| 文件 | 说明 |
|------|------|
| `Mira_*_x64-portable.exe` | **免安装**。下载后双击即可运行，适合试用或放 U 盘 |
| `Mira_*_x64-setup.exe` | NSIS 安装程序。会写开始菜单、文件关联，推荐日常安装 |
| `Mira_*_x64_en-US.msi` | MSI 安装程序。企业/静默部署可用；与 NSIS 功能等价 |
| Source code (zip/tar.gz) | 源码归档，不是可运行程序 |

安装包依赖系统 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)（Win10/11 通常已自带）。

## 功能概览

### 写作
- 所见即所得（Tiptap），支持 GFM：标题、列表、任务、表格、引用、代码块、删除线等
- 数学公式 `$…$` / `$$…$$`（KaTeX），Mermaid 图表，GitHub Alerts（`[!NOTE]` 等）
- 高亮 `==文字==`、上下标、脚注标记、折叠块、Front Matter
- 格式工具栏；输入 `/` 斜杠命令、`:emoji:` 短代码；括号自动配对
- 专注模式、打字机模式；大纲侧栏；字数与行列状态

### 文件与工作区
- 打开/保存 `.md`，原子写；拖入文件或系统「用 Mira 打开」自动载入
- 工作区文件树、最近打开、工作区搜索（`Ctrl+Shift+F`）
- 大文件（≥200KB）自动切源码模式（CodeMirror 虚拟滚动）
- 源码模式（`Ctrl+Shift+M`），与 WYSIWYG 共享同一文档

### 查找与导出
- 文内查找/替换（`Ctrl+F` / `Ctrl+H`），VS Code 风格悬浮条
- 导出 HTML / PDF / Word (.doc) / PNG，本地图片内联

### 设置
- 主题（浅/深/跟随系统）、字号、自动保存延迟、图片本地化策略
- 自定义 CSS、快捷键自定义、斜杠命令开关、单实例开关

## 快捷键（默认）

| 操作 | 快捷键 |
|------|--------|
| 新建 / 打开 / 保存 | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` |
| 查找 / 替换 | `Ctrl+F` / `Ctrl+H` |
| 源码模式 | `Ctrl+Shift+M` |
| 命令面板 | `Ctrl+Shift+P` |
| 设置 | `Ctrl+,` |
| 工作区搜索 | `Ctrl+Shift+F` |

## 开发

```bash
npm install
npm run tauri dev          # 开发模式（首次编译 Rust 较慢）
npx tauri build --no-bundle  # 生成便携 mira.exe（内嵌前端）
npm run tauri build          # 生成 MSI / NSIS 安装包
npm test
```

**前提**：Node.js、Rust（rustup）、Windows 上需 WebView2 + MSVC 构建工具。  
正式 exe 请用 `tauri build` / `npx tauri build --no-bundle`，不要只跑 `cargo build`（会连开发服务器）。

图标源文件：`docs/icon-mira.svg`；多尺寸见 `docs/icons/` 与 `scripts/make-icons.py`。

## 技术栈

- Tauri 2（Rust）+ Vue 3 + Vite + TypeScript  
- Tiptap / ProseMirror + CodeMirror 6 + KaTeX + Mermaid + lowlight  

## 发版（维护者）

推 `v*` tag 会触发 GitHub Actions，在 Windows 上打包并生成 Draft Release（便携 exe + NSIS + MSI）。确认无误后在 GitHub 上 Publish。

```powershell
# 版本号需同时改：package.json / tauri.conf.json / Cargo.toml
git tag v0.1.0
git push origin v0.1.0
```

## 状态

核心编辑能力已完成，可日常使用。发布向剩余：自动更新签名、mac/Linux 打包、完整 E2E。

## License

MIT
