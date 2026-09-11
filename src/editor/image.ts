// 本地图片扩展：相对路径存储（便携），渲染时转 convertFileSrc（asset 协议）加载。
// 粘贴/拖拽图片 → write_asset 存到 ./assets/ → 插入 ![](./assets/x.png)。
import Image from "@tiptap/extension-image";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

const DOC_DIR_KEY = "miraDocDir"; // editor.storage 上存的当前文档所在目录

function notifyInserted(src: string) {
  window.dispatchEvent(new CustomEvent("mira:image-inserted", { detail: { src } }));
}

function notifyError(message: string) {
  console.warn(message);
  window.dispatchEvent(new CustomEvent("mira:image-error", { detail: { message } }));
}

function normalizeNativePath(path: string): string {
  const uncPrefix = "\\\\?\\UNC\\";
  const localPrefix = "\\\\?\\";
  if (path.startsWith(uncPrefix)) return "\\\\" + path.slice(uncPrefix.length);
  if (path.startsWith(localPrefix)) return path.slice(localPrefix.length);
  return path;
}
function currentDocDir(editor: any): string | undefined {
  const docDir = editor.storage?.[DOC_DIR_KEY];
  return docDir ? normalizeNativePath(docDir) : docDir;
}

function ensureDocDir(editor: any): string | null {
  const docDir = currentDocDir(editor);
  if (!docDir) {
    notifyError("请先保存文档后再插入本地图片");
    return null;
  }
  return docDir;
}

// 解析相对路径 → 绝对路径（基于当前文档目录）
function resolveSrc(src: string, docDir: string | undefined): string {
  if (!src) return src;
  // 仅处理相对路径（./ 或 ../）；绝对/http(s)/data 不动
  if (src.startsWith("./") || src.startsWith("../")) {
    if (!docDir) return src;
    // 简单拼接（前端不规范化路径，交由 convertFileSrc）
    const base = docDir.replace(/[\\/]+$/, "");
    return base + "/" + src;
  }
  return src;
}

function toLoadable(src: string, docDir: string | undefined): string {
  const abs = resolveSrc(src, docDir);
  if (abs.startsWith("./") || abs.startsWith("../") || abs.match(/^[A-Za-z]:[\\/]/) || abs.startsWith("/")) {
    // 本地路径 → convertFileSrc
    return convertFileSrc(abs);
  }
  return abs; // http(s)/data 直接用
}

export const MiraImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        // 解析 HTML 时保持原样（相对路径）
        renderHTML: ({ src }) => src ? { src } : {},
      },
      alt: { default: "" },
      title: { default: null },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    // 渲染时把相对 src 转成可加载 URL；不修改 node.attrs.src，文档中仍保存相对路径。
    const docDir = (this.editor as any).storage?.[DOC_DIR_KEY];
    const loadable = toLoadable(node.attrs.src, docDir);
    return ["img", { ...HTMLAttributes, src: loadable }];
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("mira-image-paste"),
        props: {
          handlePaste(view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;
            for (const item of Array.from(items)) {
              if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (!file) return false;
                const docDir = ensureDocDir(editor);
                if (!docDir) return true;
                const { from, to } = view.state.selection;
                void insertImageFile(view, editor, docDir, file, from, to);
                return true;
              }
            }
            return false;
          },
          handleDrop(view, event) {
            const files = Array.from((event as DragEvent).dataTransfer?.files || []);
            const images = files.filter((f) => f.type.startsWith("image/"));
            if (!images.length) return false;
            const docDir = ensureDocDir(editor);
            event.preventDefault();
            event.stopPropagation();
            if (!docDir) return true;
            const drop = view.posAtCoords({ left: event.clientX, top: event.clientY });
            const insertAt = drop?.pos ?? view.state.selection.from;
            void insertImageFiles(view, editor, docDir, images, insertAt);
            return true;
          },
        },
      }),
    ];
  },
});

async function insertImageFiles(view: any, editor: any, docDir: string, files: File[], insertAt: number) {
  let pos = insertAt;
  for (const file of files) {
    pos = await insertImageFile(view, editor, docDir, file, pos, pos);
  }
}

async function insertImageFile(view: any, editor: any, docDir: string, file: File, from: number, to: number): Promise<number> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name || `pasted-${Date.now()}.png`;
  try {
    // 读取图片策略（相对路径 / assets 子目录）；绝对路径策略对粘贴 blob 不适用，回退 assets。
    let subdir: string | undefined;
    try {
      const raw = JSON.parse(localStorage.getItem("mira-settings") || "{}");
      if (raw?.imageStrategy === "relative") subdir = ".";
    } catch {
      /* ignore */
    }
    const rel = await invoke<string>("write_asset", {
      dir: docDir,
      name,
      bytes: Array.from(bytes),
      subdir,
    });
    const node = editor.schema.nodes.image.create({ src: rel, alt: name });
    const safeFrom = Math.min(from, view.state.doc.content.size);
    const safeTo = Math.min(to, view.state.doc.content.size);
    const tr = view.state.tr.replaceRangeWith(safeFrom, safeTo, node).scrollIntoView();
    view.focus();
    view.dispatch(tr);
    notifyInserted(rel);
    return safeFrom + node.nodeSize;
  } catch (e) {
    const message = `图片插入失败：${e}`;
    notifyError(message);
    return from;
  }
}
