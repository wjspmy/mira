/**
 * 发布前冒烟清单（手动 / CI 可脚本化）。
 * Tauri WebDriver E2E 环境依赖较重，这里先固化用例与入口，便于后续接 Playwright。
 */
export interface SmokeStep {
  id: string;
  title: string;
  action: string;
  expect: string;
}

export const SMOKE_CHECKLIST: SmokeStep[] = [
  {
    id: "open-file",
    title: "打开文件",
    action: "Ctrl+O 选择 sample.md",
    expect: "编辑器显示内容，状态栏路径正确",
  },
  {
    id: "type-and-save",
    title: "输入并保存",
    action: "输入文字后 Ctrl+S",
    expect: "状态变为已保存，磁盘文件更新",
  },
  {
    id: "source-toggle",
    title: "源码切换",
    action: "Ctrl+Shift+M 往返切换",
    expect: "内容不丢，光标大致保持",
  },
  {
    id: "find-replace",
    title: "查找替换",
    action: "Ctrl+F 查找，Ctrl+H 替换",
    expect: "能定位并替换",
  },
  {
    id: "export-html",
    title: "导出 HTML",
    action: "文件→导出 HTML",
    expect: "生成文件，图片内联可见",
  },
  {
    id: "toolbar",
    title: "工具栏",
    action: "点击加粗/标题下拉",
    expect: "格式生效，按钮激活态正确",
  },
  {
    id: "slash",
    title: "斜杠命令",
    action: "空行输入 /",
    expect: "弹出插入菜单",
  },
];

export function formatSmokeReport(passed: string[], failed: string[]): string {
  return [
    `通过 ${passed.length} / 失败 ${failed.length}`,
    ...failed.map((id) => `FAIL: ${id}`),
  ].join("\n");
}
