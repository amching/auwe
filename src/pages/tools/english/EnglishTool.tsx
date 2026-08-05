import {
  Check,
  Copy,
  EyeIcon,
  EyeOffIcon,
  Loader2,
  RefreshCwIcon,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useTrialChannel } from "@/lib/llm/trial";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/settings";
import { Segmented } from "../Segmented";
import { PracticeGuide } from "./PracticeGuide";
import {
  DEFAULT_SPEAK_STYLE,
  SPEAK_STYLES,
  type SpeakStyle,
  speakStyleLabel,
} from "./prompts";
import {
  countChars,
  isResultStale,
  SUGGESTED_MAX,
  SUGGESTED_MIN,
} from "./text";
import { useEnglishSpeak } from "./useEnglishSpeak";

/**
 * 用英语学说话：中文写清意思 → AI 转成地道英文 → 拿去做语音、跟读背诵。
 * 训练方法出自李笑来《1000 小时》；两套提示词一字不改地照送（见 ./prompts.ts）。
 */
export function EnglishTool() {
  const configured = useSettings((s) =>
    Boolean(s.endpoint && s.apiKey && s.model),
  );
  // 未配置 BYOK 时探测官方试用通道，可用则功能照常开放。
  const trial = useTrialChannel(!configured);
  const llmReady = configured || trial.status === "available";

  const [input, setInput] = useState("");
  const [style, setStyle] = useState<SpeakStyle>(DEFAULT_SPEAK_STYLE);
  /** 点了生成但没写内容时的就地提示（一输入就消失）。 */
  const [emptyHint, setEmptyHint] = useState(false);
  /** 主动回忆：把英文正文换成遮罩，自己先想一遍。 */
  const [masked, setMasked] = useState(false);
  /** 本次在途生成所依据的中文与表达方式（生成中的结果区据此展示）。 */
  const [pending, setPending] = useState<{
    chinese: string;
    style: SpeakStyle;
  } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const { status, result, error, generate } = useEnglishSpeak();

  const isBusy = status === "generating";
  const count = countChars(input);
  // 只有中文改了才算过期——表达方式的标签就在结果卡上，不会看错。
  const stale = !isBusy && isResultStale(result?.chinese ?? null, input);
  // 初始状态不出现空白结果卡片：只有生成中或已有结果时才渲染结果区。
  const showResult = isBusy || result !== null;

  // 新结果到手就恢复英文可见（上一次的「隐藏」不该盖住新答案）。
  useEffect(() => {
    if (result) setMasked(false);
  }, [result]);

  // 生成成功后把结果区滚进视野：block "nearest" —— 已经看得见就不动，
  // 需要滚也只滚最小距离，不会把页面猛地拽到底部。
  useEffect(() => {
    if (status !== "success") return;
    const el = resultRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "nearest",
    });
  }, [status]);

  function submit() {
    if (isBusy) return;
    if (!input.trim()) {
      setEmptyHint(true);
      inputRef.current?.focus();
      return;
    }
    setEmptyHint(false);
    setPending({ chinese: input.trim(), style });
    void generate(input, style);
  }

  return (
    <div className="space-y-4">
      <PracticeGuide />

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

      {/* ————— 中文输入 ————— */}
      <div className="space-y-2">
        <label
          htmlFor="english-input"
          className="block text-ui-sm text-muted-foreground"
        >
          先用中文写清楚意思，不必考虑英文怎么说。
        </label>
        <Textarea
          id="english-input"
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (emptyHint) setEmptyHint(false);
          }}
          placeholder="例如：中午想吃点什么"
          aria-describedby="english-count"
          // field-sizing-content 让它随内容长高；max-h 之后转内部滚动，页面不被撑爆。
          className="max-h-[22rem] min-h-28 overflow-y-auto text-ui leading-relaxed"
        />
        <div
          id="english-count"
          className="flex items-center justify-between gap-3 text-ui-xs text-faint"
        >
          {/* 只是建议：少于下限、多于上限都不拦，也不额外报警。 */}
          <span>
            建议 {SUGGESTED_MIN}～{SUGGESTED_MAX} 字
          </span>
          <span className="tabular-nums">
            {count} / {SUGGESTED_MAX}
          </span>
        </div>
      </div>

      {/* ————— 表达方式 + 生成 —————
          分段控件与主按钮同一行：控件是灰底轨道上的小芯片，主按钮是唯一的实心块，
          层级一眼分明——两个同尺寸按钮竖叠会跟主操作抢注意力。 */}
      <div className="space-y-2">
        {/* gap-6：分段控件是填色轨道、主按钮是实心块，挨太近会读成同一条工具栏。 */}
        <div className="flex flex-wrap items-center gap-6">
          {/* 去掉了可见的「表达方式」标题，靠标签自解释；SR 仍需要这个组名。 */}
          <fieldset aria-label="表达方式">
            <Segmented
              value={style}
              onChange={setStyle}
              options={SPEAK_STYLES.map((s) => ({
                value: s.value,
                label: s.label,
              }))}
              className="w-44"
            />
          </fieldset>
          <Button onClick={submit} disabled={isBusy || !llmReady}>
            {isBusy ? (
              <>
                <Loader2 className="animate-spin motion-reduce:animate-none" />
                正在生成…
              </>
            ) : (
              "生成英文表达"
            )}
          </Button>
          {emptyHint && (
            <span role="alert" className="text-ui-sm text-destructive">
              先写下你想表达的内容。
            </span>
          )}
        </div>
        <p className="text-ui-xs text-faint">
          {SPEAK_STYLES.find((s) => s.value === style)?.hint}
        </p>

        {status === "error" && (
          <div className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <p className="text-ui-sm text-destructive">
              暂时没有生成成功，请再试一次。
            </p>
            {/* items-start：详情展开后文字会往下长，重试按钮仍与「查看详情」同一行对齐。 */}
            <div className="flex flex-wrap items-start gap-3">
              <Button variant="outline" size="sm" onClick={submit}>
                <RefreshCwIcon />
                重试
              </Button>
              {error && (
                <details className="min-w-0 text-ui-xs text-muted-foreground">
                  <summary className="cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                    查看详情
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap opacity-90">{error}</p>
                </details>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ————— 结果区（只在生成中 / 已有结果时出现） ————— */}
      {showResult && (
        <section
          ref={resultRef}
          aria-busy={isBusy}
          className="scroll-mt-20 space-y-3 border-t pt-4"
        >
          {/* 单一 SR live region：播报状态变化，不抢焦点 */}
          <p role="status" aria-live="polite" className="sr-only">
            {isBusy
              ? "正在生成英文表达"
              : status === "success"
                ? "英文表达已生成"
                : ""}
          </p>

          {stale && (
            <div className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-ui-xs text-foreground">
              <TriangleAlert aria-hidden className="size-3.5 text-warning" />
              中文内容已修改，请重新生成英文表达。
            </div>
          )}

          <div className={cn("space-y-3", stale && "opacity-60")}>
            {/* 1. 中文原话：弱化的小区域，方便和英文对照 */}
            <div className="rounded-md bg-muted/60 px-3 py-2">
              <p className="text-ui-xs text-faint">你的原话</p>
              <p className="mt-1 whitespace-pre-wrap text-ui-sm text-muted-foreground">
                {isBusy ? pending?.chinese : result?.chinese}
              </p>
            </div>

            {/* 2. 英文表达 */}
            <div className="space-y-2">
              <h2 className="text-ui-sm font-medium">英文可以这样说</h2>
              <Card className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">
                    {speakStyleLabel(
                      (isBusy ? pending?.style : result?.style) ??
                        DEFAULT_SPEAK_STYLE,
                    )}
                  </Badge>
                  <CopyButton
                    text={result?.english ?? ""}
                    disabled={isBusy || !result}
                  />
                </div>

                {isBusy ? (
                  // 稳定高度的骨架屏：三行占位，避免结果到达时布局大幅跳动。
                  <div className="space-y-2 py-0.5">
                    {["w-full", "w-[92%]", "w-3/5"].map((w) => (
                      <div
                        key={w}
                        className={cn(
                          "h-4 rounded bg-muted motion-safe:animate-pulse",
                          w,
                        )}
                      />
                    ))}
                  </div>
                ) : masked ? (
                  <div className="space-y-2 py-0.5">
                    <p className="text-ui-sm text-muted-foreground">
                      答案已隐藏，先根据中文尝试回忆。
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMasked(false)}
                    >
                      <EyeIcon />
                      查看英文
                    </Button>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-ui leading-relaxed">
                    {result?.english}
                  </p>
                )}
              </Card>
            </div>

            {/* 次级操作：主动回忆 + 低权重的重新生成 */}
            {!isBusy && result && (
              <div className="flex flex-wrap items-center gap-1">
                {!masked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-faint"
                    onClick={() => setMasked(true)}
                  >
                    <EyeOffIcon />
                    隐藏英文，自己想一遍
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-faint"
                  onClick={submit}
                  disabled={!llmReady}
                >
                  <RefreshCwIcon />
                  重新生成
                </Button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/** 复制英文正文；剪贴板不可用时静默失败，不打断主流程。 */
function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用（无权限 / 非安全上下文）时不提示，避免打断练习节奏。
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={copy} disabled={disabled}>
      {copied ? <Check /> : <Copy />}
      {copied ? "已复制" : "复制"}
    </Button>
  );
}
