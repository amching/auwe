import type { EditorView } from "@uiw/react-codemirror";
import { ClipboardPaste, Eraser, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useTrialChannel } from "@/lib/llm/trial";
import { cn } from "@/lib/utils";
// 与简历语义无耦合的通用 Markdown 编辑器（见其文件头注释），直接复用不另起炉灶。
import { MarkdownEditor } from "@/pages/resume/MarkdownEditor";
import { useSettings } from "@/stores/settings";
import {
  promptHighlightExtension,
  revealFragment,
  setActiveHighlight,
  setPromptHighlights,
} from "./highlight";
import { ResultPanel } from "./ResultPanel";
import { SAMPLE_PROMPT } from "./samplePrompt";
import { useDeconstruct } from "./useDeconstruct";

/**
 * Prompt 解构工作台：左「Prompt 原文」编辑器 / 右「解构结果」双栏。
 * 核心价值是「原文片段 ↔ Prompt 结构」双向联动，而不是右侧输出一篇总结：
 * - 右侧点结构节点 / 原文依据 → 左侧滚动定位 + 强调高亮；
 * - 左侧点已识别片段 → 右侧对应节点选中并滚入视口。
 * 结果不持久化（草稿与结果强绑定当次会话），刷新即清。
 */
export function PromptPage() {
  const configured = useSettings((s) =>
    Boolean(s.endpoint && s.apiKey && s.model),
  );
  // 未配置 BYOK 时探测官方试用通道，可用则功能照常开放。
  const trial = useTrialChannel(!configured);
  const llmReady = configured || trial.status === "available";

  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { status, result, error, analyze } = useDeconstruct();

  const analyzing = status === "analyzing";
  const hasInput = Boolean(input.trim());
  const canAnalyze = hasInput && llmReady && !analyzing;
  const stale = result !== null && input !== result.source;

  // 结果变化（新一轮解构完成/首轮完成）→ 重挂左侧片段高亮，选中态清零。
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const specs =
      result?.analysis.logicFlow.flatMap((n) =>
        n.fragments.map((f) => ({ nodeId: n.id, from: f.from, to: f.to })),
      ) ?? [];
    view.dispatch({
      effects: [setPromptHighlights.of(specs), setActiveHighlight.of(null)],
    });
    setSelectedId(null);
  }, [result]);

  /** 选中结构节点（null 取消）；reveal 时把它的第一个片段滚到左侧视口中部。 */
  const selectNode = useCallback(
    (nodeId: string | null, opts?: { reveal?: boolean }) => {
      setSelectedId(nodeId);
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ effects: setActiveHighlight.of(nodeId) });
      if (nodeId && opts?.reveal) {
        const node = result?.analysis.logicFlow.find((n) => n.id === nodeId);
        const first = node?.fragments[0];
        if (first) revealFragment(view, first.from);
      }
    },
    [result],
  );

  const revealNodeFragment = useCallback(
    (nodeId: string, index: number) => {
      setSelectedId(nodeId);
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ effects: setActiveHighlight.of(nodeId) });
      const node = result?.analysis.logicFlow.find((n) => n.id === nodeId);
      const frag = node?.fragments[index];
      if (frag) revealFragment(view, frag.from);
    },
    [result],
  );

  // 左侧点击已识别片段 → 右侧对应节点选中并滚入视口（依赖全走 ref/DOM，引用稳定）。
  const onFragmentClick = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    viewRef.current?.dispatch({ effects: setActiveHighlight.of(nodeId) });
    document
      .getElementById(`prompt-node-${nodeId}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  // 扩展引用必须稳定（MarkdownEditor 会因引用变化整体重配）。
  const extensions = useMemo(
    () => [promptHighlightExtension(onFragmentClick)],
    [onFragmentClick],
  );

  const startAnalyze = useCallback(() => {
    setSelectedId(null);
    viewRef.current?.dispatch({ effects: setActiveHighlight.of(null) });
    void analyze(input);
  }, [analyze, input]);

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const view = viewRef.current;
      if (view) {
        view.dispatch(view.state.replaceSelection(text));
      } else {
        setInput((prev) => prev + text);
      }
    } catch {
      // 剪贴板不可读（权限/浏览器限制）时静默失败，用户仍可 ⌘V 粘贴。
    }
  }

  // 桌面端把工作台钉在视口高度内（两栏各自滚动）：需 lg:flex-none，
  // 否则 flex-1 的 basis 0 + grow 会让内容把 section 撑高、页面整体滚动。
  return (
    <section className="flex w-full flex-1 flex-col gap-4 px-[clamp(1rem,3vw,1.5rem)] py-5 lg:h-[calc(100svh-3.5rem-1px)] lg:flex-none lg:overflow-hidden">
      {/* 页面说明区：紧凑信息，不做营销页 */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-heading text-xl font-semibold">Prompt 解构</h1>
        <p className="text-ui-sm text-muted-foreground">
          把一段长 Prompt 拆成目标、结构、约束与可复用骨架。
        </p>
      </div>

      {!configured && trial.status === "available" && (
        <div className="rounded-md border border-dashed p-3 text-ui-sm text-muted-foreground">
          <Sparkles aria-hidden className="mr-1 inline size-3 align-[-1px]" />
          试用模式：由官方提供的 {trial.provider ?? "官方通道"} · {trial.model}
          {" 驱动，共享额度仅供体验。也可在"}
          <span className="mx-1">
            <SettingsDialog
              trigger={
                <Button variant="link" className="h-auto p-0">
                  设置
                </Button>
              }
            />
          </span>
          里填入自己的 API Key。
        </div>
      )}
      {!configured && trial.status === "unavailable" && (
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

      {/* 工作区：桌面左右双栏（42/58）各自滚动；窄屏上下堆叠 */}
      <div className="grid min-h-0 flex-1 items-stretch gap-4 lg:grid-cols-[42fr_58fr]">
        {/* ————— 左：Prompt 原文 ————— */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 py-2.5">
            <CardTitle className="shrink-0">Prompt 原文</CardTitle>
            <div className="flex min-w-0 items-center gap-0.5">
              <span className="mr-1.5 whitespace-nowrap text-ui-xs tabular-nums text-faint">
                {input.length} 字符
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={pasteFromClipboard}
                disabled={analyzing}
              >
                <ClipboardPaste />
                粘贴
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInput("")}
                disabled={!input || analyzing}
              >
                <Eraser />
                清空
              </Button>
            </div>
          </CardHeader>
          <div className="min-h-0 flex-1 border-t">
            <div className="h-[45vh] lg:h-full">
              <MarkdownEditor
                value={input}
                onChange={setInput}
                extraExtensions={extensions}
                onCreateEditor={(view) => {
                  viewRef.current = view;
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t p-3">
            <Button
              onClick={startAnalyze}
              disabled={!canAnalyze}
              className="min-w-28"
            >
              {analyzing ? (
                <>
                  <Loader2 className="animate-spin motion-reduce:animate-none" />
                  正在解构…
                </>
              ) : (
                "开始解构"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setInput(SAMPLE_PROMPT)}
              disabled={hasInput || analyzing}
              title={hasInput ? "先清空输入，再填入示例" : undefined}
            >
              使用示例
            </Button>
            {!hasInput && (
              <span className="text-ui-xs text-faint">
                粘贴一段 Prompt，或先看看示例。
              </span>
            )}
          </div>
        </Card>

        {/* ————— 右：解构结果 ————— */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b py-2.5">
            <CardTitle>解构结果</CardTitle>
          </CardHeader>
          <div
            className={cn("min-h-0 flex-1 p-4", "overflow-y-auto")}
            aria-busy={analyzing}
          >
            <ResultPanel
              status={status}
              analysis={result?.analysis ?? null}
              error={error}
              stale={stale}
              selectedId={selectedId}
              onSelectNode={selectNode}
              onRevealFragment={revealNodeFragment}
              onReanalyze={startAnalyze}
              canReanalyze={canAnalyze}
            />
          </div>
        </Card>
      </div>
    </section>
  );
}
