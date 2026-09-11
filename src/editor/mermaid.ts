import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeView } from "@tiptap/pm/view";
import type { NodeViewRendererProps } from "@tiptap/core";

function renderMermaidInto(host: HTMLElement, code: string, id: string): () => void {
  let cancelled = false;
  const run = async () => {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: document.documentElement.dataset.theme === "dark" ? "dark" : "neutral",
      fontFamily: "inherit",
    });
    try {
      const { svg } = await mermaid.render(id, code);
      if (!cancelled) {
        host.innerHTML = svg;
        host.classList.remove("mermaid-error");
      }
    } catch (error) {
      if (!cancelled) {
        host.classList.add("mermaid-error");
        host.textContent = `Mermaid 渲染失败：${error instanceof Error ? error.message : error}`;
      }
    }
  };
  void run();
  return () => {
    cancelled = true;
  };
}

function createMermaidNodeView(node: PMNode): NodeView {
  const dom = document.createElement("div");
  dom.className = "mermaid-block";
  dom.setAttribute("contenteditable", "false");

  const preview = document.createElement("div");
  preview.className = "mermaid-preview";
  const source = document.createElement("pre");
  source.className = "mermaid-source";
  source.textContent = node.textContent;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mermaid-toggle";
  toggle.textContent = "显示源码";
  toggle.addEventListener("click", () => {
    const showingSource = dom.classList.toggle("show-source");
    toggle.textContent = showingSource ? "显示图表" : "显示源码";
  });

  dom.append(toggle, preview, source);

  let dispose: (() => void) | null = null;
  let lastCode = node.textContent;

  const mountRender = (code: string) => {
    dispose?.();
    const rid = `mira-mermaid-${Math.random().toString(36).slice(2, 10)}`;
    dispose = renderMermaidInto(preview, code, rid);
  };

  if (node.textContent.trim()) mountRender(node.textContent);

  return {
    dom,
    update(updated: PMNode) {
      if (updated.type.name !== "codeBlock") return false;
      if (updated.attrs.language !== "mermaid") return false;
      source.textContent = updated.textContent;
      if (updated.textContent !== lastCode) {
        lastCode = updated.textContent;
        if (updated.textContent.trim()) mountRender(updated.textContent);
        else preview.innerHTML = "";
      }
      return true;
    },
    destroy() {
      dispose?.();
    },
  };
}

/** CodeBlock：language=mermaid 时渲染图表（对标 Vditor / MarkText / Typora）。 */
export function createMermaidCodeBlock(base: typeof CodeBlockLowlight, lowlight: unknown) {
  return base
    .extend({
      addNodeView() {
        const parentView = this.parent?.() as
          | ((props: NodeViewRendererProps) => NodeView)
          | undefined;
        return (props: NodeViewRendererProps): NodeView => {
          if (props.node.attrs.language === "mermaid") {
            return createMermaidNodeView(props.node);
          }
          if (parentView) return parentView(props);
          const dom = document.createElement("pre");
          const code = document.createElement("code");
          code.textContent = props.node.textContent;
          dom.append(code);
          return {
            dom,
            update: (updated) => {
              if (updated.type.name !== "codeBlock") return false;
              code.textContent = updated.textContent;
              return true;
            },
            destroy: () => {},
          };
        };
      },
    })
    .configure({ lowlight } as never);
}
