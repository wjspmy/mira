import Blockquote from "@tiptap/extension-blockquote";
import { detectGithubAlert, type GithubAlertType } from "./toolbar";

/** 引用块：首段为 [!NOTE] 等标记时，渲染为 GitHub Alerts 样式。 */
export const GithubAlertBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alertType: {
        default: null as GithubAlertType | null,
        parseHTML: (element) => {
          const attr = element.getAttribute("data-alert");
          return attr ? (attr.toUpperCase() as GithubAlertType) : null;
        },
        renderHTML: (attributes) =>
          attributes.alertType ? { "data-alert": String(attributes.alertType).toLowerCase() } : {},
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    let alertType = (node.attrs.alertType as GithubAlertType | null) ?? null;
    if (!alertType) {
      const first = node.firstChild;
      if (first?.type.name === "paragraph") {
        alertType = detectGithubAlert(first.textContent);
      }
    }
    const attrs = { ...HTMLAttributes };
    if (alertType) attrs["data-alert"] = alertType.toLowerCase();
    else delete attrs["data-alert"];
    return ["blockquote", attrs, 0];
  },
});
