import { Button } from "@/components/ui/button";
import { useResume } from "@/stores/resume";
import { MarkdownEditor } from "./MarkdownEditor";
import { ResumePreview } from "./ResumePreview";
import { usePrintResume } from "./usePrintResume";

// 简历工作台：左编辑器 / 右预览纸双栏 + 底部工具栏（字数、导出 PDF）。
export function ResumePage() {
  const markdown = useResume((s) => s.markdown);
  const setMarkdown = useResume((s) => s.setMarkdown);
  const { print } = usePrintResume();
  const charCount = markdown.replace(/\s/g, "").length;
  const canExport = markdown.trim().length > 0;

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
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground/70">
            打印时选「另存为 PDF」，关掉页眉和页脚
          </span>
          <Button onClick={print} disabled={!canExport}>
            导出 PDF
          </Button>
        </div>
      </div>
    </section>
  );
}
