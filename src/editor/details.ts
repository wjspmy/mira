import { Node, mergeAttributes } from "@tiptap/core";

export const DetailsSummary = Node.create({
  name: "detailsSummary",
  group: "block",
  content: "text*",
  defining: true,
  parseHTML: () => [{ tag: "summary" }],
  renderHTML: ({ HTMLAttributes }) => ["summary", mergeAttributes(HTMLAttributes), 0],
});

export const DetailsBlock = Node.create({
  name: "details",
  group: "block",
  content: "detailsSummary block+",
  defining: true,
  isolating: true,

  parseHTML: () => [
    {
      tag: "details",
      getAttrs: (el) => (el.tagName === "DETAILS" ? {} : false),
      contentElement: (el) => el as HTMLElement,
    },
  ],

  renderHTML: () => ["details", { class: "mira-details" }, 0],
});
