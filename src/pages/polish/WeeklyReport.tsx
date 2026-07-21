import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PolishScale } from "./PolishScale";
import {
  POLISH_LEVELS,
  type PolishLevel,
  type WeeklyReportInput,
} from "./prompts";
import { ReportResultPanel } from "./ReportResultPanel";
import { isWeeklyReportStale, useWeeklyReport } from "./useWeeklyReport";
import { formatWeekLabel, shiftWeek, weekOf } from "./weekRange";

const PROGRESS_PLACEHOLDER = `例如：
- 完成登录页两个问题修复
- 和后端确认接口调整方案
- Prompt 解构页面完成第一版`;

const UNFINISHED_PLACEHOLDER = `例如：
- 新接口还没上线，等待后端联调`;

const PLAN_PLACEHOLDER = `例如：
- 完成周报功能开发
- 推进新接口联调`;

const RISK_PLACEHOLDER = `例如：
- 接口上线时间尚未确定`;

/** 是否已配置好 LLM（BYOK 或试用通道），由 PolishPage 统一探测后传入。 */
interface WeeklyReportProps {
  llmReady: boolean;
}

export function WeeklyReport({ llmReady }: WeeklyReportProps) {
  // 默认当前自然周（周一 ~ 周日）；上一周 / 下一周整体平移。
  const [week, setWeek] = useState(() => weekOf(new Date()));
  const weekLabel = useMemo(() => formatWeekLabel(week), [week]);

  const [progress, setProgress] = useState("");
  const [unfinished, setUnfinished] = useState("");
  const [nextWeekPlan, setNextWeekPlan] = useState("");
  const [risks, setRisks] = useState("");
  // 「风险与需要协助」默认折叠；已填内容时保持展开以免隐藏已写的内容。
  const [risksOpen, setRisksOpen] = useState(false);
  const [level, setLevel] = useState<PolishLevel>(3);

  const { output, status, error, snapshot, pendingLevel, generate } =
    useWeeklyReport();

  const currentInput: WeeklyReportInput = {
    weekLabel,
    progress,
    unfinished,
    nextWeekPlan,
    risks,
  };

  const isBusy = status === "generating" || status === "regenerating";
  const hasProgress = Boolean(progress.trim());
  const canGenerate = hasProgress && llmReady && !isBusy;
  const stale = !isBusy && isWeeklyReportStale(snapshot, currentInput, level);
  // 复用日报同一套润色档位，仅把「专业」档说明换成周报语境（其余档位说明与汇报类型无关）。
  const currentHint =
    level === 3
      ? "整理为结构清晰、重点明确的职场周报"
      : POLISH_LEVELS.find((m) => m.level === level)?.hint;
  const pendingLabel = POLISH_LEVELS.find(
    (m) => m.level === pendingLevel,
  )?.label;
  const shownLabel = POLISH_LEVELS.find(
    (m) => m.level === snapshot?.level,
  )?.label;

  const risksExpanded = risksOpen || Boolean(risks.trim());

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* ————— 左：本周信息填写 ————— */}
      <Card>
        <CardHeader className="gap-2 pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>本周工作</CardTitle>
            {/* 本周时间范围 + 上/下一周切换（第一版不做日历弹窗） */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="上一周"
                onClick={() => setWeek((w) => shiftWeek(w, -1))}
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-40 text-center text-ui-sm font-medium tabular-nums">
                {weekLabel}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="下一周"
                onClick={() => setWeek((w) => shiftWeek(w, 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 1) 本周完成与进展（必填，主要输入） */}
          <Field
            title="本周完成与进展"
            hint="写下本周推进的事情，不用整理，AI 会帮你归纳。"
          >
            <Textarea
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              placeholder={PROGRESS_PLACEHOLDER}
              className="min-h-48 text-ui leading-relaxed"
            />
          </Field>

          {/* 2) 未完成与原因（可选，默认展开） */}
          <Field
            title="未完成与原因"
            optional
            hint="有哪些事情没有按计划完成？为什么？"
          >
            <Textarea
              value={unfinished}
              onChange={(e) => setUnfinished(e.target.value)}
              placeholder={UNFINISHED_PLACEHOLDER}
              className="min-h-24 text-ui leading-relaxed"
            />
          </Field>

          {/* 3) 下周计划（可选，默认展开） */}
          <Field title="下周计划" optional hint="下周最重要的事情是什么？">
            <Textarea
              value={nextWeekPlan}
              onChange={(e) => setNextWeekPlan(e.target.value)}
              placeholder={PLAN_PLACEHOLDER}
              className="min-h-28 text-ui leading-relaxed"
            />
          </Field>

          {/* 4) 风险与需要协助（可选，默认折叠） */}
          <div className="space-y-2">
            <button
              type="button"
              aria-expanded={risksExpanded}
              onClick={() => setRisksOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 text-left"
            >
              <ChevronDown
                className={cn(
                  "size-3.5 text-faint transition-transform",
                  risksExpanded ? "rotate-0" : "-rotate-90",
                )}
              />
              <span className="text-ui-sm font-medium">风险与需要协助</span>
              <span className="text-ui-xs text-faint">（可选）</span>
            </button>
            {risksExpanded && (
              <div className="space-y-1 pl-5">
                <p className="text-ui-xs text-faint">
                  有哪些阻塞、风险，或需要别人支持的事情？
                </p>
                <Textarea
                  value={risks}
                  onChange={(e) => setRisks(e.target.value)}
                  placeholder={RISK_PLACEHOLDER}
                  className="min-h-24 text-ui leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* 润色程度（复用日报刻度） */}
          <div className="space-y-2">
            <p className="text-ui-sm font-medium">润色程度</p>
            <PolishScale value={level} onChange={setLevel} disabled={isBusy} />
            <p className="text-ui-xs text-faint">{currentHint}</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => generate(currentInput, level)}
              disabled={!canGenerate}
              className="min-w-30"
            >
              {isBusy ? (
                <>
                  <Loader2 className="animate-spin motion-reduce:animate-none" />
                  正在生成…
                </>
              ) : (
                "生成周报"
              )}
            </Button>
            {!hasProgress && (
              <span className="text-ui-xs text-faint">
                先写下本周完成的事情。
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ————— 右：生成结果（与日报共用） ————— */}
      <ReportResultPanel
        reportNoun="周报"
        output={output}
        status={status}
        error={error}
        stale={stale}
        isBusy={isBusy}
        canRegenerate={canGenerate}
        shownLabel={shownLabel}
        pendingLabel={pendingLabel}
        firstGenBusyTitle="正在整理你的本周工作"
        emptyText="输入本周进展、问题和计划，生成一份结构清晰的周报。"
        onRegenerate={() => generate(currentInput, level)}
      />
    </div>
  );
}

/** 左侧带标题 + 说明的输入分区（progress / unfinished / nextWeekPlan 共用）。 */
function Field({
  title,
  hint,
  optional,
  children,
}: {
  title: string;
  hint: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-ui-sm font-medium">{title}</span>
        {optional && <span className="text-ui-xs text-faint">（可选）</span>}
      </div>
      <p className="text-ui-xs text-faint">{hint}</p>
      {children}
    </div>
  );
}
