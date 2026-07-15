import {
  Check,
  ChevronDown,
  Copy,
  CornerDownRight,
  RefreshCw,
  ScanText,
  TriangleAlert,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CATEGORY_META, type FlowNode, type PromptAnalysis } from "./analysis";
import type { DeconstructStatus } from "./useDeconstruct";

/**
 * 右栏：解构结果的全部展示态（空态 / 骨架屏 / 错误 / 成功四态）。
 * 成功态层级：核心意图 → 逻辑结构图 → 结构详情 → 核心思想 → Prompt 骨架。
 * 与左侧编辑器的联动通过 onSelectNode / onRevealFragment 回调交给页面侧完成。
 */

interface ResultPanelProps {
  status: DeconstructStatus;
  analysis: PromptAnalysis | null;
  error: string | null;
  /** 结果生成后原文又被改过 → 标记过期，提供重新解构。 */
  stale: boolean;
  selectedId: string | null;
  /** 选中结构节点；reveal 为 true 时同时定位左侧原文。 */
  onSelectNode: (nodeId: string | null, opts?: { reveal?: boolean }) => void;
  /** 定位某节点的第 index 个原文片段。 */
  onRevealFragment: (nodeId: string, index: number) => void;
  /** 重新分析（错误重试与过期重新解构共用）。 */
  onReanalyze: () => void;
  canReanalyze: boolean;
}

export function ResultPanel({
  status,
  analysis,
  error,
  stale,
  selectedId,
  onSelectNode,
  onRevealFragment,
  onReanalyze,
  canReanalyze,
}: ResultPanelProps) {
  // 单一 SR 播报源：状态变化时告知，不抢焦点。
  const liveMessage =
    status === "analyzing"
      ? "正在解构 Prompt"
      : status === "success"
        ? "解构完成"
        : status === "error"
          ? "解构失败"
          : "";

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {status === "analyzing" ? (
        <AnalyzingSkeleton />
      ) : status === "error" ? (
        <div className="space-y-3">
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-ui-sm text-destructive">
            <p className="font-medium">暂时无法完成解构</p>
            <p className="mt-0.5 text-ui-xs opacity-90">
              {error ?? "请检查网络或稍后重试。"}你的原始 Prompt 不会丢失。
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onReanalyze}
            disabled={!canReanalyze}
          >
            <RefreshCw />
            重新分析
          </Button>
          {/* 失败但已有旧结果：降透明度原样保留，用户输入与结果都不丢 */}
          {analysis && (
            <div className="opacity-60">
              <AnalysisView
                analysis={analysis}
                selectedId={selectedId}
                onSelectNode={onSelectNode}
                onRevealFragment={onRevealFragment}
              />
            </div>
          )}
        </div>
      ) : analysis ? (
        <div className="space-y-3">
          {stale && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-ui-xs text-foreground">
              <TriangleAlert className="size-3.5 text-warning" />
              原文已修改，当前结果可能已过期。
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 px-2"
                onClick={onReanalyze}
                disabled={!canReanalyze}
              >
                重新解构
              </Button>
            </div>
          )}
          <div className={stale ? "opacity-60" : undefined}>
            <AnalysisView
              analysis={analysis}
              selectedId={selectedId}
              onSelectNode={onSelectNode}
              onRevealFragment={onRevealFragment}
            />
          </div>
        </div>
      ) : (
        <EmptyState />
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 py-10 text-center">
      <ScanText aria-hidden strokeWidth={1.5} className="size-8 text-faint" />
      <p className="text-ui font-medium text-muted-foreground">等待解构</p>
      <p className="max-w-64 text-ui-sm leading-relaxed text-faint">
        粘贴一段 Prompt，系统会识别它的目标、结构、约束和输出方式。
      </p>
    </div>
  );
}

// 骨架行宽度：模拟最终结果的结构（摘要卡 + 若干结构节点），避免上屏时布局跳动。
const NODE_SKELETON_WIDTHS = ["88%", "94%", "82%", "90%"];

function AnalyzingSkeleton() {
  return (
    <div className="space-y-4">
      <div
        aria-hidden
        className="indeterminate-track h-0.5 w-full rounded-full bg-primary/15"
      >
        <span className="indeterminate-bar" />
      </div>
      <div className="space-y-0.5">
        <p className="text-ui-sm font-medium">正在解构 Prompt</p>
        <p className="text-ui-xs text-muted-foreground">
          识别目标、结构、约束与可复用骨架，通常需要十几秒。
        </p>
      </div>
      <div aria-hidden className="space-y-3">
        <div className="h-20 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        {NODE_SKELETON_WIDTHS.map((w, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 固定的静态占位行，无重排
            key={i}
            className="h-14 animate-pulse rounded-md bg-muted motion-reduce:animate-none"
            style={{ width: w }}
          />
        ))}
      </div>
    </div>
  );
}

interface AnalysisViewProps {
  analysis: PromptAnalysis;
  selectedId: string | null;
  onSelectNode: ResultPanelProps["onSelectNode"];
  onRevealFragment: ResultPanelProps["onRevealFragment"];
}

function AnalysisView({
  analysis,
  selectedId,
  onSelectNode,
  onRevealFragment,
}: AnalysisViewProps) {
  return (
    <div className="space-y-6">
      <SummarySection summary={analysis.summary} />
      <FlowSection
        nodes={analysis.logicFlow}
        selectedId={selectedId}
        onSelectNode={onSelectNode}
      />
      <DetailSection
        nodes={analysis.logicFlow}
        selectedId={selectedId}
        onSelectNode={onSelectNode}
        onRevealFragment={onRevealFragment}
      />
      {analysis.principles.length > 0 && (
        <PrinciplesSection principles={analysis.principles} />
      )}
      <SkeletonSection skeleton={analysis.skeleton} />
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-ui-sm font-medium text-foreground">{children}</h3>;
}

function CategoryBadge({ category }: { category: FlowNode["category"] }) {
  const meta = CATEGORY_META[category];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-ui-xs font-medium leading-none",
        meta.badgeClass,
      )}
    >
      {meta.label}
    </span>
  );
}

function SummarySection({ summary }: { summary: PromptAnalysis["summary"] }) {
  const meta = [
    { label: "任务类型", value: summary.taskType },
    { label: "目标对象", value: summary.target },
    { label: "主要产物", value: summary.deliverable },
  ].filter((m) => m.value);
  return (
    <section className="space-y-2">
      <SectionTitle>核心意图</SectionTitle>
      <div className="rounded-md border bg-primary/[0.03] px-3 py-2.5">
        <p className="text-ui leading-relaxed">{summary.coreIntent}</p>
        {meta.length > 0 && (
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2">
            {meta.map((m) => (
              <div key={m.label} className="flex items-baseline gap-1.5">
                <dt className="text-ui-xs text-faint">{m.label}</dt>
                <dd className="text-ui-xs font-medium text-foreground">
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

function FlowSection({
  nodes,
  selectedId,
  onSelectNode,
}: {
  nodes: FlowNode[];
  selectedId: string | null;
  onSelectNode: ResultPanelProps["onSelectNode"];
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <SectionTitle>逻辑结构</SectionTitle>
        <span className="text-ui-xs text-faint">点击节点定位左侧原文</span>
      </div>
      <ol>
        {nodes.map((n, i) => (
          <li key={n.id}>
            {i > 0 && (
              <div aria-hidden className="ml-6 h-3 w-px bg-border-strong" />
            )}
            <button
              type="button"
              onClick={() => onSelectNode(n.id, { reveal: true })}
              aria-pressed={n.id === selectedId}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
                n.id === selectedId
                  ? "border-primary/45 bg-primary/5"
                  : "hover:bg-muted/60",
              )}
            >
              <div className="flex items-center gap-2">
                <CategoryBadge category={n.category} />
                <span className="min-w-0 truncate text-ui font-medium">
                  {n.title}
                </span>
                <span className="ml-auto shrink-0 text-ui-xs text-faint">
                  {n.fragments.length} 个原文片段
                </span>
              </div>
              <p className="mt-1 text-ui-sm leading-relaxed text-muted-foreground">
                {n.summary}
              </p>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-ui-xs font-medium text-faint">{label}</p>
      <div className="text-ui-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </div>
  );
}

function DetailSection({
  nodes,
  selectedId,
  onSelectNode,
  onRevealFragment,
}: {
  nodes: FlowNode[];
  selectedId: string | null;
  onSelectNode: ResultPanelProps["onSelectNode"];
  onRevealFragment: ResultPanelProps["onRevealFragment"];
}) {
  return (
    <section className="space-y-2">
      <SectionTitle>结构详情</SectionTitle>
      <div className="space-y-1.5">
        {nodes.map((n) => {
          const open = n.id === selectedId;
          return (
            <div
              key={n.id}
              id={`prompt-node-${n.id}`}
              className={cn(
                "scroll-mt-2 rounded-md border transition-colors duration-150",
                open && "border-primary/45",
              )}
            >
              {/* 已展开时再点标题 = 折叠（回到无选中态） */}
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onSelectNode(open ? null : n.id)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <CategoryBadge category={n.category} />
                <span className="min-w-0 truncate text-ui-sm font-medium">
                  {n.title}
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "ml-auto size-3.5 shrink-0 text-faint transition-transform duration-150",
                    open && "rotate-180",
                  )}
                />
              </button>
              {open && (
                <div className="space-y-3 border-t px-3 pt-2.5 pb-3">
                  <DetailField label="提取内容">{n.summary}</DetailField>
                  <DetailField label="它的作用">{n.purpose}</DetailField>
                  <DetailField label="原文依据">
                    {n.fragments.length > 0 ? (
                      <div className="space-y-1.5">
                        {n.fragments.map((f, idx) => (
                          <button
                            type="button"
                            // biome-ignore lint/suspicious/noArrayIndexKey: 片段列表随结果整体重建，无重排
                            key={idx}
                            onClick={() => onRevealFragment(n.id, idx)}
                            title="点击定位原文"
                            className="group flex w-full items-start gap-1.5 rounded-sm border-l-2 border-primary/40 bg-muted/50 px-2.5 py-1.5 text-left text-ui-sm leading-relaxed text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            <CornerDownRight
                              aria-hidden
                              className="mt-0.5 size-3 shrink-0 text-faint group-hover:text-muted-foreground"
                            />
                            <span className="min-w-0">
                              {truncate(f.text, 140)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-ui-xs text-faint">
                        未能在原文中定位到对应片段。
                      </p>
                    )}
                  </DetailField>
                  {n.riskIfMissing && (
                    <DetailField label="缺少它可能导致">
                      {n.riskIfMissing}
                    </DetailField>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PrinciplesSection({ principles }: { principles: string[] }) {
  return (
    <section className="space-y-2">
      <SectionTitle>核心思想</SectionTitle>
      <ol className="space-y-2">
        {principles.map((p, i) => (
          <li key={p} className="flex gap-2.5">
            <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-ui-xs font-medium text-secondary-foreground">
              {i + 1}
            </span>
            <span className="text-ui-sm leading-relaxed text-foreground/90">
              {p}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SkeletonSection({ skeleton }: { skeleton: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(skeleton);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默失败，不打断主流程。
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <SectionTitle>Prompt 骨架</SectionTitle>
        <span className="text-ui-xs text-faint">
          去掉业务内容后的可复用模板
        </span>
      </div>
      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b bg-muted/40 py-0.5 pr-1 pl-3">
          <span className="font-mono text-ui-xs text-faint">Markdown</span>
          <Button variant="ghost" size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "已复制" : "复制骨架"}
          </Button>
        </div>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap px-3 py-2.5 font-mono text-ui-xs leading-relaxed text-foreground/90">
          {skeleton}
        </pre>
      </div>
    </section>
  );
}

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
