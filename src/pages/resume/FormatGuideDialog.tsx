import { CheckIcon, CopyIcon } from "lucide-react";
import { type ReactElement, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EXAMPLE_RESUME } from "./sampleResume";

/** 四条核心格式约定（与 ResumePreview 的结构推断规则一一对应）。 */
const RULES: { label: string; code: string; hint: string }[] = [
  {
    label: "姓名",
    code: "# 张三",
    hint: "居中大标题；紧跟其后的第一段会成为联系方式行。",
  },
  {
    label: "章节",
    code: "## 工作经历",
    hint: "章节标题，自动带下边线。",
  },
  {
    label: "经历条目",
    code: "### 高级前端工程师 · 某某科技 | 2023 – 至今",
    hint: "按最后一个 | 分成两端：左边是标题，右边是时间。",
  },
  {
    label: "强制分页",
    code: "---\n---",
    hint: "连续两条分隔线：之后的内容从新的一页开始，两条线本身不显示。",
  },
];

/**
 * 格式指南弹窗：随时可查的参考文档，只由用户点击触发，不做任何首次引导。
 * 「查看完整示例」在弹窗内切换视图（不开第二层弹窗）；关闭后焦点回到触发按钮
 * （Base UI Dialog 默认行为，Escape / 遮罩 / 右上角 X 同理）。
 */
export function FormatGuideDialog({ trigger }: { trigger: ReactElement }) {
  const [view, setView] = useState<"guide" | "example">("guide");
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(EXAMPLE_RESUME);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默失败，不打断主流程。
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setView("guide");
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-[640px]">
        {view === "guide" ? (
          <>
            <DialogHeader>
              <DialogTitle>简历格式指南</DialogTitle>
              <DialogDescription>
                使用普通 Markdown 编写，系统会自动完成简历排版。
              </DialogDescription>
            </DialogHeader>
            <div className="scroll-subtle min-h-0 flex-1 space-y-4 overflow-y-auto">
              {RULES.map((rule) => (
                <div key={rule.label} className="space-y-1.5">
                  <p className="text-ui-sm font-medium text-foreground">
                    {rule.label}
                  </p>
                  <CodeBlock>{rule.code}</CodeBlock>
                  <p className="text-ui-xs text-muted-foreground">
                    {rule.hint}
                  </p>
                </div>
              ))}
              <p className="border-t pt-3 text-ui-xs text-faint">
                Markdown 注释只在编辑器中可见，不会进入预览和导出的 PDF。
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setView("example")}>
                查看完整示例
              </Button>
              <DialogClose render={<Button />}>关闭</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>完整示例</DialogTitle>
              <DialogDescription>
                一份用到全部格式约定的简历模板，可复制后替换成自己的内容。
              </DialogDescription>
            </DialogHeader>
            <div className="scroll-subtle min-h-0 flex-1 overflow-y-auto">
              <CodeBlock>{EXAMPLE_RESUME.trim()}</CodeBlock>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setView("guide")}>
                返回格式指南
              </Button>
              <Button onClick={copyExample}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "已复制" : "复制示例"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-ui-sm leading-relaxed whitespace-pre-wrap text-foreground">
      {children}
    </pre>
  );
}
