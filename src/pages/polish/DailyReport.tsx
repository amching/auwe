import { Check, Copy, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownPreview } from "@/lib/markdown/MarkdownPreview";
import { useSettings } from "@/stores/settings";
import { PolishScale } from "./PolishScale";
import { POLISH_LEVELS, type PolishLevel } from "./prompts";
import { IndeterminateBar, ReportSkeleton } from "./ReportLoading";
import { isReportStale, useDailyReport } from "./useDailyReport";

const PLACEHOLDER = `例如：
- 修复登录页的两个问题
- 和后端确认接口调整方案
- 新接口还没完成，功能暂未上线`;

export function DailyReport() {
  const { isConfigured } = useSettings();
  const [input, setInput] = useState("");
  const [level, setLevel] = useState<PolishLevel>(3);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { output, status, error, snapshot, pendingLevel, generate } =
    useDailyReport();

  const isBusy = status === "generating" || status === "regenerating";
  const hasInput = Boolean(input.trim());
  const canGenerate = hasInput && isConfigured() && !isBusy;
  const stale = !isBusy && isReportStale(snapshot, input, level);
  const currentHint = POLISH_LEVELS.find((m) => m.level === level)?.hint;
  // loading 文案用「正在生成时」的等级；结果副标题用「已生成结果」的等级。
  const pendingLabel = POLISH_LEVELS.find(
    (m) => m.level === pendingLevel,
  )?.label;
  const shownLabel = POLISH_LEVELS.find(
    (m) => m.level === snapshot?.level,
  )?.label;

  // 单一 SR 播报源：状态变化时告知，但不抢焦点。
  const liveMessage =
    status === "generating"
      ? "正在生成日报"
      : status === "regenerating"
        ? "正在重新生成日报"
        : status === "success"
          ? "日报已生成"
          : status === "error"
            ? "生成失败"
            : "";

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

  return (
    <div className="space-y-4">
      {!isConfigured() && (
        <div className="rounded-md border border-dashed p-3 text-ui-sm text-muted-foreground">
          还没配置 AI。请先在
          <span className="mx-1">
            <SettingsDialog
              trigger={
                <Button variant="link" className="h-auto p-0">
                  设置
                </Button>
              }
            />
          </span>
          里填入 Endpoint、API Key 和 Model。
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* ————— 左：输入 + 刻度 + 生成 ————— */}
        <Card>
          <CardHeader className="gap-1 pb-3">
            <CardTitle>今天做了什么</CardTitle>
            <p className="text-ui-sm text-muted-foreground">
              不用整理，想到什么就写什么。支持自然语言或 Markdown 列表。
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={PLACEHOLDER}
              className="min-h-40 text-ui leading-relaxed"
            />

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-ui-sm font-medium">润色程度</span>
                <span className="text-ui-sm text-muted-foreground">
                  {level} ·{" "}
                  {POLISH_LEVELS.find((m) => m.level === level)?.label}
                </span>
              </div>
              <PolishScale
                value={level}
                onChange={setLevel}
                disabled={isBusy}
              />
              <p className="text-ui-xs text-faint">{currentHint}</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => generate(input, level)}
                disabled={!canGenerate}
                className="min-w-30"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="animate-spin motion-reduce:animate-none" />
                    正在生成…
                  </>
                ) : (
                  "生成日报"
                )}
              </Button>
              {!hasInput && (
                <span className="text-ui-xs text-faint">
                  先写点今天做的事再生成。
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ————— 右：生成结果（页面 chrome，非 LLM 生成） ————— */}
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
                  onClick={() => generate(input, level)}
                  disabled={!canGenerate}
                >
                  <RefreshCw
                    className={
                      isBusy
                        ? "animate-spin motion-reduce:animate-none"
                        : undefined
                    }
                  />
                  重新生成
                </Button>
              </div>
            </div>
            {output && shownLabel && (
              <p className="text-ui-sm text-muted-foreground">
                日报 · {shownLabel}
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
                    {status === "regenerating"
                      ? "正在重新生成"
                      : "正在整理你的工作内容"}
                  </p>
                  <p className="text-ui-xs text-muted-foreground">
                    {status === "regenerating"
                      ? `使用「${pendingLabel}」等级重新润色…`
                      : `正在根据「${pendingLabel}」等级生成日报…`}
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
                  {error && (
                    <p className="mt-0.5 text-ui-xs opacity-90">{error}</p>
                  )}
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
              <p className="text-ui-sm text-faint">
                输入今天完成的事情，生成一份日报。
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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
