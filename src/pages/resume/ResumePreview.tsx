import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { sanitizeSchema } from "@/lib/markdown/sanitize";

interface ResumePreviewProps {
  markdown: string;
}

/**
 * 简历纸：白底黑墨、A4 宽度、带 --paper-shadow 浮起（见 plan/design.md）。
 * 独立于 App 亮暗——不用 dark:prose-invert，纸永远深墨浅底。
 * 必过共享 sanitizeSchema（铁律 2：用户与 LLM 的 Markdown 都不可信）。
 * M1 只做基础纸感；pt 字阶与 H1/联系行/H3 日期拆分为 M2。
 */
export function ResumePreview({ markdown }: ResumePreviewProps) {
  return (
    <div
      className="mx-auto w-full max-w-[210mm] rounded-sm px-[16mm] py-[14mm]"
      style={{
        background: "var(--paper)",
        color: "var(--paper-ink)",
        boxShadow: "var(--paper-shadow)",
        minHeight: "297mm",
      }}
    >
      <div className="prose prose-neutral max-w-none">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        >
          {markdown}
        </Markdown>
      </div>
    </div>
  );
}
