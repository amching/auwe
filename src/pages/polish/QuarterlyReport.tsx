import { ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PolishScale } from "./PolishScale";
import {
  POLISH_LEVELS,
  type PolishLevel,
  type QuarterlyReportInput,
} from "./prompts";
import {
  formatQuarterDateRange,
  formatQuarterLabel,
  quarterOf,
  shiftQuarter,
} from "./quarterRange";
import { ReportResultPanel } from "./ReportResultPanel";
import { CollapsibleSection, Field } from "./reportFields";
import {
  isQuarterlyReportStale,
  useQuarterlyReport,
} from "./useQuarterlyReport";

const MAX_ACHIEVEMENTS = 5;

const GOALS_PLACEHOLDER = `例如：
- 完成职场工具站第一版
- 上线日报、周报和 Prompt 解构功能`;

const PRIORITIES_PLACEHOLDER = `例如：
- 完成核心功能上线
- 邀请第一批真实用户验证`;

const RISK_PLACEHOLDER = `例如：
- 功能持续增加，但用户价值尚未验证`;

/** 单条成果的本地状态：带稳定 id，避免用数组下标做 key。 */
interface AchievementState {
  id: number;
  action: string;
  impact: string;
  evidence: string;
}

const emptyAchievement = (id: number): AchievementState => ({
  id,
  action: "",
  impact: "",
  evidence: "",
});

/** 是否已配置好 LLM（BYOK 或试用通道），由 PolishPage 统一探测后传入。 */
interface QuarterlyReportProps {
  llmReady: boolean;
}

export function QuarterlyReport({ llmReady }: QuarterlyReportProps) {
  const [quarter, setQuarter] = useState(() => quarterOf(new Date()));
  const quarterLabel = useMemo(() => formatQuarterLabel(quarter), [quarter]);
  const quarterRange = useMemo(
    () => formatQuarterDateRange(quarter),
    [quarter],
  );

  const [goals, setGoals] = useState("");
  const idRef = useRef(1);
  const [achievements, setAchievements] = useState<AchievementState[]>(() => [
    emptyAchievement(0),
  ]);
  const [unfinished, setUnfinished] = useState("");
  const [priorities, setPriorities] = useState("");
  const [risks, setRisks] = useState("");
  const [risksOpen, setRisksOpen] = useState(false);
  const [level, setLevel] = useState<PolishLevel>(3);

  const { output, status, error, snapshot, pendingLevel, generate } =
    useQuarterlyReport();

  const currentInput: QuarterlyReportInput = {
    quarterLabel,
    quarterRange,
    goals,
    achievements: achievements.map(({ action, impact, evidence }) => ({
      action,
      impact,
      evidence,
    })),
    unfinished,
    nextQuarterPriorities: priorities,
    risks,
  };

  const isBusy = status === "generating" || status === "regenerating";
  const hasGoals = Boolean(goals.trim());
  // 「至少一项关键成果」以「做了什么」为准（成果的核心字段）。
  const hasAchievement = achievements.some((a) => a.action.trim());
  const hasPriorities = Boolean(priorities.trim());
  const ready = hasGoals && hasAchievement && hasPriorities;
  const canGenerate = ready && llmReady && !isBusy;
  const stale =
    !isBusy && isQuarterlyReportStale(snapshot, currentInput, level);
  // 复用五档润色，仅「专业」档说明换成季度语境。
  const currentHint =
    level === 3
      ? "整理为重点突出、体现价值的季度汇报"
      : POLISH_LEVELS.find((m) => m.level === level)?.hint;
  const pendingLabel = POLISH_LEVELS.find(
    (m) => m.level === pendingLevel,
  )?.label;
  const shownLabel = POLISH_LEVELS.find(
    (m) => m.level === snapshot?.level,
  )?.label;
  const risksExpanded = risksOpen || Boolean(risks.trim());

  function updateAchievement(
    id: number,
    field: "action" | "impact" | "evidence",
    value: string,
  ) {
    setAchievements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    );
  }
  function addAchievement() {
    setAchievements((prev) =>
      prev.length >= MAX_ACHIEVEMENTS
        ? prev
        : [...prev, emptyAchievement(idRef.current++)],
    );
  }
  function removeAchievement(id: number) {
    setAchievements((prev) =>
      prev.length <= 1 ? prev : prev.filter((a) => a.id !== id),
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* ————— 左：季度信息填写 ————— */}
      <Card>
        <CardHeader className="gap-2 pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>季度信息</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="上一季度"
                onClick={() => setQuarter((q) => shiftQuarter(q, -1))}
              >
                <ChevronLeft />
              </Button>
              <div className="min-w-40 text-center">
                <div className="text-ui-sm font-medium">{quarterLabel}</div>
                <div className="text-ui-xs text-faint tabular-nums">
                  {quarterRange}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="下一季度"
                onClick={() => setQuarter((q) => shiftQuarter(q, 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 1) 本季度目标与职责（必填） */}
          <Field
            title="本季度目标与职责"
            hint="这个季度主要负责什么？原本希望达成什么结果？"
          >
            <Textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder={GOALS_PLACEHOLDER}
              className="min-h-28 text-ui leading-relaxed"
            />
          </Field>

          {/* 2) 关键成果（必填，可增删，最多 5 条） */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-ui-sm font-medium">关键成果</span>
              <span className="text-ui-xs text-faint">
                分清「做了什么」和「产生了什么价值」· 最多 {MAX_ACHIEVEMENTS} 项
              </span>
            </div>
            {achievements.map((a, i) => (
              <div
                key={a.id}
                className="space-y-2 rounded-md border border-border bg-muted/30 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-ui-xs font-medium text-muted-foreground">
                    成果 {i + 1}
                  </span>
                  {achievements.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`删除成果 ${i + 1}`}
                      onClick={() => removeAchievement(a.id)}
                    >
                      <X />
                    </Button>
                  )}
                </div>
                <AchievementInput
                  label="做了什么"
                  value={a.action}
                  onChange={(v) => updateAchievement(a.id, "action", v)}
                  placeholder="完成日报、周报生成能力"
                />
                <AchievementInput
                  label="产生了什么结果或影响"
                  value={a.impact}
                  onChange={(v) => updateAchievement(a.id, "impact", v)}
                  placeholder="用户可以把零散工作整理为结构化汇报"
                />
                <AchievementInput
                  label="数据或证据"
                  optional
                  value={a.evidence}
                  onChange={(v) => updateAchievement(a.id, "evidence", v)}
                  placeholder="完成 3 个核心页面，覆盖 5 档润色程度"
                />
              </div>
            ))}
            {achievements.length < MAX_ACHIEVEMENTS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAchievement}
              >
                <Plus />
                添加一项成果
              </Button>
            )}
          </div>

          {/* 3) 未完成事项与复盘（可选，默认展开） */}
          <Field
            title="未完成事项与复盘"
            optional
            hint="哪些目标没有完成？原因是什么？从中学到了什么？"
          >
            <Textarea
              value={unfinished}
              onChange={(e) => setUnfinished(e.target.value)}
              placeholder="例如：部分功能仍停留在设计阶段，尚未做真实用户验证。"
              className="min-h-24 text-ui leading-relaxed"
            />
          </Field>

          {/* 4) 下季度重点（必填） */}
          <Field title="下季度重点" hint="下一季度最重要的 1～3 件事情是什么？">
            <Textarea
              value={priorities}
              onChange={(e) => setPriorities(e.target.value)}
              placeholder={PRIORITIES_PLACEHOLDER}
              className="min-h-24 text-ui leading-relaxed"
            />
          </Field>

          {/* 5) 风险与需要支持（可选，默认折叠） */}
          <CollapsibleSection
            title="风险与需要支持"
            hint="有哪些风险、资源缺口或需要协作的事情？"
            open={risksExpanded}
            onToggle={() => setRisksOpen((v) => !v)}
          >
            <Textarea
              value={risks}
              onChange={(e) => setRisks(e.target.value)}
              placeholder={RISK_PLACEHOLDER}
              className="min-h-24 text-ui leading-relaxed"
            />
          </CollapsibleSection>

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
                "生成季度汇报"
              )}
            </Button>
            {!ready && (
              <span className="text-ui-xs text-faint">
                先填目标、至少一项成果和下季度重点。
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ————— 右：生成结果（与日报 / 周报共用） ————— */}
      <ReportResultPanel
        reportNoun="季度汇报"
        output={output}
        status={status}
        error={error}
        stale={stale}
        isBusy={isBusy}
        canRegenerate={canGenerate}
        shownLabel={shownLabel}
        pendingLabel={pendingLabel}
        firstGenBusyTitle="正在整理你的季度工作"
        emptyText="填写季度目标、关键成果和下季度重点，生成一份体现价值的季度汇报。"
        onRegenerate={() => generate(currentInput, level)}
      />
    </div>
  );
}

/** 成果条目内的紧凑带标题输入框。 */
function AchievementInput({
  label,
  optional,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Textarea 渲染出真实 <textarea>，label 包裹即关联
    <label className="block space-y-1">
      <span className="text-ui-xs text-muted-foreground">
        {label}
        {optional && <span className="text-faint">（可选）</span>}
      </span>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-14 text-ui leading-relaxed"
      />
    </label>
  );
}
