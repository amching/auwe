import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PolishScale } from "./PolishScale";
import { POLISH_LEVELS, type PolishLevel } from "./prompts";
import { ReportResultPanel } from "./ReportResultPanel";
import { isReportStale, useDailyReport } from "./useDailyReport";

const PLACEHOLDER = `例如：
- 修复登录页的两个问题
- 和后端确认接口调整方案
- 新接口还没完成，功能暂未上线`;

/** 是否已配置好 LLM（BYOK 或试用通道），由 PolishPage 统一探测后传入。 */
interface DailyReportProps {
  llmReady: boolean;
}

export function DailyReport({ llmReady }: DailyReportProps) {
  const [input, setInput] = useState("");
  const [level, setLevel] = useState<PolishLevel>(3);

  const { output, status, error, snapshot, pendingLevel, generate } =
    useDailyReport();

  const isBusy = status === "generating" || status === "regenerating";
  const hasInput = Boolean(input.trim());
  const canGenerate = hasInput && llmReady && !isBusy;
  const stale = !isBusy && isReportStale(snapshot, input, level);
  const currentHint = POLISH_LEVELS.find((m) => m.level === level)?.hint;
  const pendingLabel = POLISH_LEVELS.find(
    (m) => m.level === pendingLevel,
  )?.label;
  const shownLabel = POLISH_LEVELS.find(
    (m) => m.level === snapshot?.level,
  )?.label;

  return (
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
            <p className="text-ui-sm font-medium">润色程度</p>
            <PolishScale value={level} onChange={setLevel} disabled={isBusy} />
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
      <ReportResultPanel
        reportNoun="日报"
        output={output}
        status={status}
        error={error}
        stale={stale}
        isBusy={isBusy}
        canRegenerate={canGenerate}
        shownLabel={shownLabel}
        pendingLabel={pendingLabel}
        firstGenBusyTitle="正在整理你的工作内容"
        emptyText="输入今天完成的事情，生成一份日报。"
        onRegenerate={() => generate(input, level)}
      />
    </div>
  );
}
