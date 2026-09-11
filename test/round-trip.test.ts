// Round-trip 测试语料：真实 MD 样本 + 边界样本（设计 §14.3 / §21）
// parse(md) → serialize(doc) 后与原文做 mdast 规范化等价比较。
import { describe, it, expect } from "vitest";
import { roundTrip } from "../src/editor/serialize";

type Case = { name: string; md: string };

const cases: Case[] = [
  {
    name: "标题层次",
    md: "# h1\n\n## h2\n\n### h3\n\n正文段落。\n",
  },
  {
    name: "粗斜体行内代码",
    md: "这是 **粗体** 和 *斜体* 与 `code` 混排。\n",
  },
  {
    name: "无序列表",
    md: "- 第一项\n- 第二项\n  - 嵌套项\n- 第三项\n",
  },
  {
    name: "有序列表",
    md: "1. 首项\n2. 次项\n3. 第三项\n",
  },
  {
    name: "任务列表",
    md: "- [ ] 未完成\n- [x] 已完成\n- [ ] 另一个\n",
  },
  {
    name: "引用",
    md: "> 这是引用。\n>\n> 第二段。\n",
  },
  {
    name: "代码块带语言",
    md: "```js\nfunction f(x) {\n  return x + 1;\n}\n```\n",
  },
  {
    name: "代码块无语言",
    md: "```\nplain code\n```\n",
  },
  {
    name: "分隔线",
    md: "上\n\n---\n\n下\n",
  },
  {
    name: "GFM 表格",
    md: "| 名称 | 值 |\n| --- | --- |\n| alpha | 1 |\n| beta | 2 |\n",
  },
  {
    name: "行内数学",
    md: "当 $a \\ne 0$ 时，$ax^2 + bx + c = 0$ 有解。\n",
  },
  {
    name: "块级数学",
    md: "$$\nx = {-b \\pm \\sqrt{b^2-4ac} \\over 2a}\n$$\n",
  },
  {
    name: "链接",
    md: "参见 [Mira](https://example.com) 文档。\n",
  },
  {
    name: "独立图片",
    md: "![alt](./assets/a.png)\n",
  },
  {
    name: "图片标题",
    md: "![alt](./assets/a.png \"title\")\n",
  },
  {
    name: "远程图片",
    md: "![remote](https://example.com/a.png)\n",
  },
  {
    name: "硬换行",
    md: "第一行  \n第二行\n",
  },
  {
    name: "删除线",
    md: "这是 ~~删除~~ 文本。\n",
  },
  {
    name: "空段落边界",
    md: "# 标题\n\n\n\n段落。\n",
  },
  {
    name: "列表中的代码与链接",
    md: "- 项含 `code`\n- [链接](https://example.com)\n- **粗体项**\n",
  },
  {
    name: "综合文档",
    md: `# 标题

正文段落含 **粗体**、*斜体*、\`code\`。

## 列表

- 项一
- 项二
  - 嵌套

1. 有序一
2. 有序二

## 代码与引用

\`\`\`js
const x = 1;
\`\`\`

> 引用块。
>
> 第二段。

## 表格

| a | b |
| --- | --- |
| 1 | 2 |

## 数学

行内 $E=mc^2$。

$$
\\sum_{i=1}^n i = \\frac{n(n+1)}{2}
$$
`,
  },
];

describe("Markdown round-trip (parse → serialize, mdast 规范化等价)", () => {
  for (const c of cases) {
    it(c.name, () => {
      const { normIn, normOut } = roundTrip(c.md);
      try {
        expect(normOut).toBe(normIn);
      } catch (e) {
        // 失败时打印便于排查
        console.error(`\n[${c.name}] MISMATCH\n--- in ---\n${normIn}\n--- out ---\n${normOut}\n`);
        throw e;
      }
    });
  }
});
