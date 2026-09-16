// Shared Tiptap extension list for App and export (keep schema identical).
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import type { Extensions } from "@tiptap/core";
import { GithubAlertBlockquote } from "./github-alert";
import { MathInline, MathBlock } from "./math";
import { FootnoteHighlight } from "./footnotes";
import { FocusModeHighlight } from "./focus-mode";
import { AutoPair } from "./auto-pair";
import { DetailsBlock, DetailsSummary } from "./details";
import { Markdown } from "tiptap-markdown";

export function createCoreExtensions(options: { codeBlock: Extensions[number] | null; image?: Extensions[number] }): Extensions {
  const list: Extensions = [
    StarterKit.configure({ codeBlock: false, blockquote: false }),
    GithubAlertBlockquote,
    ...(options.codeBlock ? [options.codeBlock] : []),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false }),
    options.image ?? Image.configure({ inline: false }),
    MathInline,
    MathBlock,
    FootnoteHighlight,
    FocusModeHighlight,
    AutoPair,
    DetailsBlock,
    DetailsSummary,
    Markdown.configure({ html: false, breaks: true }),
  ];
  return list;
}
