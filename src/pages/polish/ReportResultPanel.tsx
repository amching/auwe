import { Check, Copy, RefreshCw, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownPreview } from "@/lib/markdown/MarkdownPreview";
import { IndeterminateBar, ReportSkeleton } from "./ReportLoading";
import type { ReportStatus } from "./useReportGeneration";

interface ReportResultPanelProps {
  /** 汇报名词，用于文案，如「日报」「周报」。 */
  reportNoun: string;
  output: string;
  status: ReportStatus;
  error: string | null;
  /** 结果是否已过期（原始内容或润色等级已改动）。 */
  stale: boolean;
  /** 生成 / 重新生成进行中。 */
  isBusy: boolean;
  /** 「重新生成」是否可用（有输入 + LLM 就绪 + 不在途）。 */
  canRegenerate: boolean;
  /** 已生成结果所用的润色等级标签（副标题用）。 */
  shownLabel?: string;
  /** 正在生成所用的润色等级标签（loading 文案用）。 */
  pendingLabel?: string;
  /** 首次生成时的 loading 标题，如「正在整理你的工作内容」。 */
  firstGenBusyTitle: string;
  /** 空状态提示文案。 */
  emptyText: string;
  onRegenerate: () => void;
}

/**
 * 右侧「生成结果」卡片——日报 / 周报共用的展示 chrome（非 LLM 生成内容）。
 * 负责：复制、重新生成、四态（生成中 / 失败 / 成功 / 空）、SR 播报、过期提示。
 * 报告类型相关的差异（名词、空态、loading 标题、等级标签）全部走 props 参数化。
 */
export function ReportResultPanel({
  reportNoun,
  output,
  status,
  error,
  stale,
  isBusy,
  canRegenerate,
  shownLabel,
  pendingLabel,
  firstGenBusyTitle,
  emptyText,
  onRegenerate,
}: ReportResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默失败，不打断主流程。
    }
  }

  // 单一 SR 播报源：状态变化时告知，但不抢焦点。
  const liveMessage =
    status === "generating"
      ? `正在生成${reportNoun}`
      : status === "regenerating"
        ? `正在重新生成${reportNoun}`
        : status === "success"
          ? `${reportNoun}已生成`
          : status === "error"
            ? "生成失败"
            : "";

  return (
    <Card>
      <CardHeader className="gap-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>生成结果</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={copy}
              disabled={!output || isBusy}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "已复制" : "复制"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              disabled={!canRegenerate}
            >
              <RefreshCw
                className={
                  isBusy ? "animate-spin motion-reduce:animate-none" : undefined
                }
              />
              重新生成
            </Button>
          </div>
        </div>
        {output && shownLabel && (
          <p className="text-ui-sm text-muted-foreground">
            {reportNoun} · {shownLabel}
          </p>
        )}
      </CardHeader>

      <CardContent aria-busy={isBusy}>
        {/* 单一 SR live region：播报状态变化，不抢焦点 */}
        <p role="status" aria-live="polite" className="sr-only">
          {liveMessage}
        </p>

        {isBusy ? (
          <div className="space-y-3">
            <IndeterminateBar />
            <div className="space-y-0.5">
              <p className="text-ui-sm font-medium text-foreground">
                {status === "regenerating" ? "正在重新生成" : firstGenBusyTitle}
              </p>
              <p className="text-ui-xs text-muted-foreground">
                {status === "regenerating"
                  ? `使用「${pendingLabel}」等级重新润色…`
                  : `正在根据「${pendingLabel}」等级生成${reportNoun}…`}
              </p>
            </div>
            {status === "regenerating" && output ? (
              // 重新生成：保留旧结果、降透明度，不清空
              <MarkdownPreview className={cnResultProse(true)}>
                {output}
              </MarkdownPreview>
            ) : (
              // 首次生成：骨架屏 + 「通常需要几秒钟」
              <>
                <ReportSkeleton />
                <p className="text-ui-xs text-faint">通常需要几秒钟。</p>
              </>
            )}
          </div>
        ) : status === "error" ? (
          <div className="space-y-2">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-ui-sm text-destructive">
              <p className="font-medium">生成失败，请稍后重试</p>
              {error && <p className="mt-0.5 text-ui-xs opacity-90">{error}</p>}
            </div>
            {/* 失败但仍有旧结果：原样保留 */}
            {output && (
              <MarkdownPreview className={cnResultProse(false)}>
                {output}
              </MarkdownPreview>
            )}
          </div>
        ) : output ? (
          <div className="space-y-2">
            {stale && (
              <div className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-ui-xs text-foreground">
                <TriangleAlert className="size-3.5 text-warning" />
                原始内容或润色等级已修改，请重新生成。
              </div>
            )}
            <MarkdownPreview className={cnResultProse(stale)}>
              {output}
            </MarkdownPreview>
          </div>
        ) : (
          <p className="text-ui-sm text-faint">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

// 工具型正文密度：比默认 prose 更小的字号/行距、更紧的列表缩进与段落间距。
// 过期或重新生成中的旧结果整体降透明度以标记「旧结果」。
function cnResultProse(dim: boolean): string {
  return [
    "prose-sm max-w-none",
    "[&_:where(p)]:my-2 [&_:where(ul,ol)]:my-2 [&_:where(ul,ol)]:pl-5",
    "[&_:where(li)]:my-0.5 [&_:where(li>p)]:my-0",
    "[&_:where(h1,h2,h3,h4)]:mt-3 [&_:where(h1,h2,h3,h4)]:mb-1.5",
    dim ? "opacity-60" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
