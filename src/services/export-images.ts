import { invoke } from "@tauri-apps/api/core";

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".avif")) return "image/avif";
  return "application/octet-stream";
}

function stripQueryHash(src: string): string {
  const q = src.indexOf("?");
  const h = src.indexOf("#");
  let end = src.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  return src.slice(0, end);
}

function joinDocPath(base: string, rel: string): string {
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  const cleaned = rel.replace(/\\/g, "/").replace(/^\.\//, "");
  return `${base.replace(/[\\/]+$/, "")}${sep}${cleaned}`;
}

/** 把相对路径 / 本地绝对路径解析为文档目录下的绝对路径。 */
export function resolveExportImageSrc(src: string, docDir: string | null | undefined): string | null {
  if (!src || !docDir) return null;
  let value = stripQueryHash(src.trim());
  if (!value || value.startsWith("data:") || /^https?:/i.test(value)) return null;

  value = value.replace(/^asset:\/\/localhost\//i, "");
  value = value.replace(/^https?:\/\/asset\.localhost\//i, "");
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  value = value.replace(/^\/([A-Za-z]:[\\/])/, "$1");

  if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\")) {
    return value;
  }
  if (value.startsWith("/")) {
    return value;
  }
  return joinDocPath(docDir, value);
}

/** 将 HTML 中的本地图片内联为 data URL，保证导出文件在应用外也能显示。 */
export async function inlineImagesInHtml(
  html: string,
  docDir: string | null | undefined,
): Promise<string> {
  if (!html || typeof document === "undefined") return html;
  const container = document.createElement("div");
  container.innerHTML = html;
  const images = Array.from(container.querySelectorAll("img"));
  if (!images.length) return html;

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || /^https?:/i.test(src)) return;
      const abs = resolveExportImageSrc(src, docDir);
      if (!abs) {
        img.setAttribute("alt", `${img.getAttribute("alt") || "image"}（缺少文档路径，无法内联）`);
        return;
      }
      try {
        await invoke("allow_path", { path: abs });
        const b64 = await invoke<string>("read_file_base64", { path: abs });
        img.setAttribute("src", `data:${mimeFromPath(abs)};base64,${b64}`);
      } catch {
        img.setAttribute("alt", `${img.getAttribute("alt") || "image"}（导出时无法读取本地图片）`);
        img.setAttribute("data-export-missing", abs);
      }
    }),
  );

  return container.innerHTML;
}
