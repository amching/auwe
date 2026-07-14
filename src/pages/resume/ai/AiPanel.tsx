import {
  ArrowUpIcon,
  CheckIcon,
  CircleAlertIcon,
  RotateCcwIcon,
  SparklesIcon,
  TextSelectIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useResume } from "@/stores/resume";
import { useSettings } from "@/stores/settings";
import { QUICK_ACTIONS } from "./prompts";
import { useResumeAi } from "./store";

const INPUT_PLACEHOLDER =
  "告诉 AI 你希望如何修改，例如：表达更精炼，突出技术难度，不添加新事实。";

interface AiPanelProps {
  /** 「重新选择」：清空目标并把焦点还给编辑器。 */
  onReselect: () => void;
}

/**
 * 右侧 AI 优化面板：范围 + 原文卡片 + 快捷指令 + 对话输入 + 建议卡片。
 * 建议只在左侧编辑器里以 Diff 形式审阅，这里承担发起与决策（应用/继续调整/放弃）。
 */
export function AiPanel({ onReselect }: AiPanelProps) {
  const target = useResumeAi((s) => s.target);
  const status = useResumeAi((s) => s.status);
  const suggestion = useResumeAi((s) => s.suggestion);
  const rounds = useResumeAi((s) => s.rounds);
  const error = useResumeAi((s) => s.error);
  const lastApplied = useResumeAi((s) => s.lastApplied);
  const start = useResumeAi((s) => s.start);
  const apply = useResumeAi((s) => s.apply);
  const discard = useResumeAi((s) => s.discard);
  const undoApply = useResumeAi((s) => s.undoApply);

  const configured = useSettings((s) =>
    Boolean(s.endpoint && s.apiKey && s.model),
  );
  // 应用后正文又被手动改过 → 无法安全撤销。
  const markdown = useResume((s) => s.markdown);
  const canUndo = lastApplied !== null && markdown === lastApplied.after;

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const streaming = status === "streaming";
  const canSend = Boolean(target) && !streaming && configured;

  // 流式输出时跟随滚动到底部。
  useEffect(() => {
    if (!streaming) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [streaming]);

  function send(instruction: string) {
    if (!canSend || !instruction.trim()) return;
    setInput("");
    void start(instruction.trim());
  }

  if (!target) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <TextSelectIcon
          aria-hidden
          className="size-8 text-faint"
          strokeWidth={1.5}
        />
        <p className="text-ui text-muted-foreground">
          在左侧编辑器中选中要优化的内容，
          <br />
          或从编辑器顶部「AI 优化」选择范围。
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className="scroll-subtle min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
      >
        {!configured && (
          <div className="rounded-md border border-dashed p-2.5 text-ui-sm text-muted-foreground">
            还没配置 AI。请先在
            <SettingsDialog
              trigger={
                <Button variant="link" className="mx-0.5 h-auto p-0 text-ui-sm">
                  设置
                </Button>
              }
            />
            里填入 Endpoint、API Key 和 Model。
          </div>
        )}

        {/* 当前编辑范围 + 原文引用卡片 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-ui-xs font-medium text-faint">优化范围</span>
            <span className="min-w-0 truncate text-ui-xs text-muted-foreground">
              {target.scope}
            </span>
            <button
              type="button"
              onClick={onReselect}
              className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-ui-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              重新选择
            </button>
          </div>
          <blockquote className="scroll-subtle max-h-36 overflow-y-auto rounded-md border-l-2 border-border-strong bg-muted/50 px-2.5 py-2 font-mono text-ui-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {target.text}
          </blockquote>
        </div>

        {/* 快捷指令 */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={!canSend}
              onClick={() => send(a.instruction)}
              className="rounded-full border px-2.5 py-1 text-ui-xs text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* 对话轮次：指令 + 建议卡片 */}
        {rounds.map((round, i) => {
          const isLast = i === rounds.length - 1;
          return (
            <div
              // 轮次只增不改（除末轮流式累加），index 稳定。
              // biome-ignore lint/suspicious/noArrayIndexKey: 见上
              key={i}
              className={cn("space-y-1.5", !isLast && "opacity-55")}
            >
              <p className="flex items-start gap-1.5 text-ui-xs text-faint">
                <span className="shrink-0 font-medium">指令</span>
                <span className="min-w-0">{round.instruction}</span>
              </p>
              <SuggestionCard
                // 只有生成中的末轮才读流式缓冲；其余（含放弃后）显示该轮定稿文本。
                text={isLast && streaming ? suggestion : round.suggestion}
                streaming={isLast && streaming}
                actionable={isLast && status === "reviewing"}
                onApply={apply}
                onRefine={() => inputRef.current?.focus()}
                onDiscard={discard}
              />
            </div>
          );
        })}

        {streaming && (
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-ui-xs text-faint">
              <SparklesIcon
                aria-hidden
                className="size-3 animate-pulse motion-reduce:animate-none"
              />
              正在生成…
            </p>
            <Button variant="ghost" size="xs" onClick={discard}>
              停止
            </Button>
          </div>
        )}

        {status === "reviewing" && (
          <p className="text-ui-xs text-faint">
            左侧编辑器已标出改动：
            <span className="mx-0.5 rounded-sm bg-destructive/10 px-1 text-destructive/80 line-through">
              删除
            </span>
            <span className="mx-0.5 rounded-sm bg-success/15 px-1 text-success">
              新增
            </span>
            ，确认后再应用。
          </p>
        )}

        {status === "applied" && (
          <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-2.5 py-2 text-ui-sm text-foreground">
            <CheckIcon aria-hidden className="size-3.5 shrink-0 text-success" />
            已应用到简历。
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto"
              disabled={!canUndo}
              onClick={undoApply}
              title={canUndo ? undefined : "正文已被再次编辑，无法整体撤销"}
            >
              <RotateCcwIcon />
              撤销
            </Button>
          </div>
        )}

        {status === "error" && error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-ui-sm text-destructive">
            <CircleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        )}
      </div>

      {/* 对话输入 */}
      <div className="shrink-0 border-t p-2.5">
        <div className="flex items-end gap-1.5">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={INPUT_PLACEHOLDER}
            rows={2}
            className="min-h-0 resize-none text-ui-sm"
            disabled={!target}
          />
          <Button
            size="icon-sm"
            aria-label="发送"
            disabled={!canSend || !input.trim()}
            onClick={() => send(input)}
          >
            <ArrowUpIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** AI 修改建议卡片：正文 + （末轮审阅时）应用 / 继续调整 / 放弃。 */
function SuggestionCard({
  text,
  streaming,
  actionable,
  onApply,
  onRefine,
  onDiscard,
}: {
  text: string;
  streaming: boolean;
  actionable: boolean;
  onApply: () => void;
  onRefine: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="scroll-subtle max-h-56 overflow-y-auto px-2.5 py-2 font-mono text-ui-xs leading-relaxed whitespace-pre-wrap text-foreground">
        {text || (streaming ? "…" : "")}
        {streaming && text && (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-primary align-middle motion-reduce:animate-none"
          />
        )}
      </div>
      {actionable && (
        <div className="flex items-center gap-1.5 border-t bg-muted/40 px-2 py-1.5">
          <Button size="xs" onClick={onApply}>
            应用修改
          </Button>
          <Button size="xs" variant="outline" onClick={onRefine}>
            继续调整
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto"
            onClick={onDiscard}
          >
            放弃
          </Button>
        </div>
      )}
    </div>
  );
}
