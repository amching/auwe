import { Button } from "@/components/ui/button";
import { useResume } from "@/stores/resume";
import { MarkdownEditor } from "./MarkdownEditor";
import { ResumePreview } from "./ResumePreview";

// 里程碑 1：resume store + 内置模板 + 编辑器/预览双栏（纸感基础样式）。
// AI 面板 (M4)、打印导出 (M3)、重置模板确认 (M5) 为后续里程碑。
export function ResumePage() {
  const markdown = useResume((s) => s.markdown);
  const setMarkdown = useResume((s) => s.setMarkdown);
  const charCount = markdown.replace(/\s/g, "").length;

  return (
    <section className="flex h-[calc(100svh-3.5rem)] flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[42%] min-w-[360px] flex-col overflow-hidden border-r">
          <MarkdownEditor value={markdown} onChange={setMarkdown} />
        </div>
        <div className="flex-1 overflow-auto bg-desk p-8">
          <ResumePreview markdown={markdown} />
        </div>
      </div>
      <div className="flex items-center justify-between border-t bg-background px-4 py-2">
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {charCount} 字
        </span>
        <Button disabled>导出 PDF</Button>
      </div>
    </section>
  );
}
