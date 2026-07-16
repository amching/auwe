import {
  ArrowUpIcon,
  BookOpenIcon,
  Check,
  CompassIcon,
  Copy,
  Loader2,
  RotateCcwIcon,
  Sparkles,
  SquareIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useTrialChannel } from "@/lib/llm/trial";
import { MarkdownPreview } from "@/lib/markdown/MarkdownPreview";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/settings";
import { LIFE_DESIGN_AUTHOR, LIFE_DESIGN_SOURCE_URL } from "./prompt";
import { useLifeDesignChat } from "./useLifeDesignChat";

/**
 * 人生设计师：基于《斯坦福大学人生设计课》方法论的多轮深度对话。
 * 提示词一字不改地取自公众号「数字生命卡兹克」的研究成果（见 ./prompt.ts）。
 */
export function LifeDesignTool() {
  const configured = useSettings((s) =>
    Boolean(s.endpoint && s.apiKey && s.model),
  );
  // 未配置 BYOK 时探测官方试用通道，可用则功能照常开放。
  const trial = useTrialChannel(!configured);
  const llmReady = configured || trial.status === "available";

  const { messages, status, error, draft, start, send, retry, stop, reset } =
    useLifeDesignChat();

  const [input, setInput] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 流式输出时是否跟随滚动：用户主动往上翻就停跟，回到底部再续上。
  const stickToBottom = useRef(true);

  const isStreaming = status === "streaming";
  const started = messages.length > 0 || isStreaming;
  // 最后一条是用户消息且不在流式中 = 这一轮请求失败了，可原样重试。
  const canRetry =
    status === "error" &&
    (messages.length === 0 || messages[messages.length - 1].role === "user");

  // biome-ignore lint/correctness/useExhaustiveDependencies: 消息/流式内容一变就该滚底。
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, draft, status]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function handleSend() {
    if (!input.trim() || isStreaming || !llmReady) return;
    stickToBottom.current = true;
    send(input);
    setInput("");
  }

  function doReset() {
    reset();
    setInput("");
    setResetOpen(false);
  }

  /** 已有回答时先弹确认（AlertDialog），空对话直接重置。 */
  function handleReset() {
    if (messages.length > 0) setResetOpen(true);
    else doReset();
  }

  return (
    <div className="space-y-4">
      {/* ————— 出处备注：提示词作者 + 方法论来源 ————— */}
      <div className="rounded-md border bg-secondary/40 p-3 text-ui-sm text-muted-foreground">
        <BookOpenIcon aria-hidden className="mr-1 inline size-3 align-[-1px]" />
        提示词来自公众号「{LIFE_DESIGN_AUTHOR}」的研究成果，
        <a
          href={LIFE_DESIGN_SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className="mx-0.5 underline underline-offset-2 hover:text-foreground"
        >
          原文在此
        </a>
        ，本站一字未改。方法论出自 Bill Burnett 和 Dave Evans
        的《斯坦福大学人生设计课》（斯坦福 d.school 最受欢迎课程）。
      </div>

      {!configured && trial.status === "available" && (
        <div className="rounded-md border border-dashed p-3 text-ui-sm text-muted-foreground">
          <Sparkles aria-hidden className="mr-1 inline size-3 align-[-1px]" />
          试用模式：由官方提供的 {trial.provider ?? "官方通道"} · {trial.model}
          {" 驱动，共享额度仅供体验。这是一场很长的对话，建议在"}
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

      <Card className="overflow-hidden">
        {/* ————— 对话区 ————— */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[62vh] min-h-72 space-y-4 overflow-y-auto scroll-smooth p-4"
        >
          {/* 单一 SR live region：播报状态变化，不抢焦点 */}
          <p role="status" aria-live="polite" className="sr-only">
            {isStreaming
              ? "人生设计师正在回复"
              : status === "error"
                ? "请求失败"
                : ""}
          </p>

          {!started && (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
                <CompassIcon className="size-5 text-muted-foreground" />
              </span>
              <div className="max-w-md space-y-1.5">
                <p className="font-medium">把人生当成一个可以反复设计的项目</p>
                <p className="text-ui-sm text-muted-foreground">
                  {
                    "AI 会像人生设计师一样，用 6~9 个主线问题陪你多轮深聊：看清现状 → 校准工作观与人生观 → 找到心流 → 生成三个五年人生版本，最后产出一份《个人人生设计蓝图》。"
                  }
                </p>
                <p className="text-ui-xs text-faint">
                  {
                    "它没法预测未来，只能把你心里本来就有、却没捋清楚的东西指出来——你答得越真诚、越具体，它能给你的就越多。"
                  }
                </p>
              </div>
              <Button onClick={start} disabled={!llmReady || isStreaming}>
                开始对话
              </Button>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: 追加式对话记录，顺序即身份。
                key={i}
                className="flex justify-end"
              >
                <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-secondary px-3 py-2 text-ui text-secondary-foreground">
                  {m.content}
                </div>
              </div>
            ) : (
              <AssistantMessage
                // biome-ignore lint/suspicious/noArrayIndexKey: 追加式对话记录，顺序即身份。
                key={i}
                content={m.content}
              />
            ),
          )}

          {isStreaming && (
            <div className="space-y-2">
              {draft ? (
                <MarkdownPreview className={PROSE_CLASS}>
                  {draft}
                </MarkdownPreview>
              ) : (
                <p className="flex items-center gap-1.5 text-ui-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                  人生设计师正在思考…
                </p>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="space-y-2">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-ui-sm text-destructive">
                <p className="font-medium">请求失败</p>
                {error && (
                  <p className="mt-0.5 whitespace-pre-wrap text-ui-xs opacity-90">
                    {error}
                  </p>
                )}
              </div>
              {canRetry && (
                <Button variant="outline" size="sm" onClick={retry}>
                  <RotateCcwIcon />
                  重试这一轮
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ————— 输入区 ————— */}
        {started && (
          <div className="space-y-2 border-t bg-secondary/30 p-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="认真回答它的问题——越真诚、越具体越好。也很适合用语音输入。"
              className="min-h-20 bg-background text-ui leading-relaxed"
              disabled={isStreaming}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcwIcon />
                  重新开始
                </Button>
                <span className="text-ui-xs text-faint">⌘/Ctrl + ↩ 发送</span>
              </div>
              {isStreaming ? (
                <Button variant="outline" size="sm" onClick={stop}>
                  <SquareIcon className="fill-current" />
                  停止
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim() || !llmReady}
                >
                  <ArrowUpIcon />
                  发送
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>重新开始这场对话？</AlertDialogTitle>
            <AlertDialogDescription>
              目前的对话和你的回答都会被清空，且无法找回。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续对话</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={doReset}>
              清空重来
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// 工具型正文密度：比默认 prose 更小的字号/行距、更紧的列表缩进与段落间距。
const PROSE_CLASS = [
  "prose-sm max-w-none",
  "[&_:where(p)]:my-2 [&_:where(ul,ol)]:my-2 [&_:where(ul,ol)]:pl-5",
  "[&_:where(li)]:my-0.5 [&_:where(li>p)]:my-0",
  "[&_:where(h1,h2,h3,h4)]:mt-3 [&_:where(h1,h2,h3,h4)]:mb-1.5",
].join(" ");

/** 助手消息：sanitize 过的 Markdown 渲染 + 悬浮复制（蓝图那条会很长，值得复制走）。 */
function AssistantMessage({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默失败，不打断主流程。
    }
  }

  return (
    <div className="group relative">
      <MarkdownPreview className={PROSE_CLASS}>{content}</MarkdownPreview>
      <Button
        variant="ghost"
        size="sm"
        onClick={copy}
        aria-label="复制这条回复"
        className={cn(
          "mt-1 h-6 px-1.5 text-ui-xs text-faint opacity-0 transition-opacity",
          "group-hover:opacity-100 focus-visible:opacity-100",
          copied && "opacity-100",
        )}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "已复制" : "复制"}
      </Button>
    </div>
  );
}
