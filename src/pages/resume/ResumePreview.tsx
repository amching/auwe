import { Children, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { sanitizeSchema } from "@/lib/markdown/sanitize";
// 自带 Noto Sans SC（OFL，可嵌入 PDF）：跨 macOS/Windows/Linux 一致渲染+打印中文/日文假名/拉丁。
// Fontsource 按 unicode-range 切片，浏览器只下载简历实际用到的字。仅简历页 chunk 加载。
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/600.css";
import "./resume.css";

/**
 * 条目标题 H3：以最后一个 `|` 拆成「左标题 / 右时间」两端对齐。
 * 平滑降级：children 含复杂内联节点（粗体/链接等）或没有 `|` 时原样渲染。
 */
function ResumeH3({ children }: { children?: ReactNode }) {
  const nodes = Children.toArray(children);
  const allText = nodes.every((n) => typeof n === "string");
  if (allText) {
    const text = nodes.join("");
    const idx = text.lastIndexOf("|");
    if (idx !== -1) {
      const left = text.slice(0, idx).trim();
      const right = text.slice(idx + 1).trim();
      return (
        <h3 className="resume-entry-head">
          <span>{left}</span>
          <span className="resume-entry-time">{right}</span>
        </h3>
      );
    }
  }
  return <h3>{children}</h3>;
}

const components: Components = { h3: ResumeH3 };

interface ResumePreviewProps {
  markdown: string;
}

/**
 * 简历纸：白底黑墨、A4 宽度、带 --paper-shadow 浮起，独立于 App 亮暗。
 * 排版全在 resume.css 的 .resume-paper 下。渲染必过共享 sanitizeSchema
 * ——用户与 LLM 的 Markdown 都不可信。
 * 屏幕纸内 padding = 打印 @page 边距的等效（14mm 上下 / 16mm 左右）。
 */
export function ResumePreview({ markdown }: ResumePreviewProps) {
  return (
    <div
      className="mx-auto w-full max-w-[210mm] rounded-paper px-[16mm] py-[14mm]"
      style={{
        background: "var(--paper)",
        boxShadow: "var(--paper-shadow)",
        minHeight: "297mm",
      }}
    >
      <div className="resume-paper">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
          components={components}
        >
          {markdown}
        </Markdown>
      </div>
    </div>
  );
}
