import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Tauri 2 推荐配置：固定端口、忽略 src-tauri、移动端 HMR 适配
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/katex") || id.includes("node_modules/mhchem")) return "katex";
          if (id.includes("node_modules/mermaid") || id.includes("node_modules/d3-") || id.includes("node_modules/cytoscape")) {
            return "mermaid";
          }
          if (id.includes("node_modules/@codemirror") || id.includes("node_modules/@lezer")) return "codemirror";
          if (
            id.includes("node_modules/@tiptap") ||
            id.includes("node_modules/prosemirror") ||
            id.includes("node_modules/tiptap-markdown")
          ) {
            return "tiptap";
          }
          return undefined;
        },
      },
    },
  },
}));
