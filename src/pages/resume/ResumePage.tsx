import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useResume } from "@/stores/resume";
import { MarkdownEditor } from "./MarkdownEditor";
import { ResumePreview } from "./ResumePreview";
import { usePrintResume } from "./usePrintResume";

// 下载 Markdown 源文件（客户端生成 Blob，不经服务器）。
function downloadMarkdown(markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "resume.md";
  a.click();
  URL.revokeObjectURL(url);
}

// 简历工作台：左编辑器 / 右预览纸双栏（小屏退化为 tab）+ 底部工具栏。
export function ResumePage() {
  const markdown = useResume((s) => s.markdown);
  const setMarkdown = useResume((s) => s.setMarkdown);
  const resetToTemplate = useResume((s) => s.resetToTemplate);
  const { print } = usePrintResume();

  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [resetOpen, setResetOpen] = useState(false);

  const charCount = markdown.replace(/\s/g, "").length;
  const hasContent = markdown.trim().length > 0;

  return (
    <section className="flex h-[calc(100svh-3.5rem)] flex-col">
      {/* 小屏 tab 切换（lg 以上隐藏，双栏并排） */}
      <div className="flex shrink-0 border-b lg:hidden">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 text-sm transition-colors",
              tab === t
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {t === "edit" ? "编辑" : "预览"}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 编辑器 */}
        <div
          className={cn(
            "min-h-0 flex-col overflow-hidden border-r lg:flex lg:w-[42%] lg:min-w-[360px] lg:flex-none",
            tab === "edit" ? "flex flex-1" : "hidden",
          )}
        >
          <MarkdownEditor value={markdown} onChange={setMarkdown} />
        </div>

        {/* 预览纸 / 空状态 */}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-auto bg-desk p-8 lg:block",
            tab === "preview" ? "block" : "hidden",
          )}
        >
          {hasContent ? (
            <ResumePreview markdown={markdown} />
          ) : (
            <EmptyState onRestore={resetToTemplate} />
          )}
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex shrink-0 items-center justify-between border-t bg-background px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {charCount} 字
          </span>
          <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="sm" disabled={!hasContent}>
                  重置模板
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>用内置模板覆盖当前内容？</AlertDialogTitle>
                <AlertDialogDescription>
                  当前简历会被替换成内置示例模板，此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    resetToTemplate();
                    setResetOpen(false);
                  }}
                >
                  覆盖
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button disabled={!hasContent}>
                导出
                <ChevronDownIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => downloadMarkdown(markdown)}>
              导出 Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={print}>导出 PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
  );
}

// 空状态（预览区无内容时）：单色线条小画 + 一句话 + 恢复模板。
// 内容为空、无数据可丢，恢复直接执行、不弹确认。
function EmptyState({ onRestore }: { onRestore: () => void }) {
  return (
    <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-4 text-center text-muted-foreground">
      <svg
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      </svg>
      <p className="text-sm">还没有内容。开始写，或恢复内置模板。</p>
      <Button variant="outline" size="sm" onClick={onRestore}>
        恢复模板
      </Button>
    </div>
  );
}
