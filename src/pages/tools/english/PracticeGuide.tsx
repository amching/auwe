import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { PRACTICE_SOURCE_URL } from "./prompts";

const SUMMARY = "写下中文 → 生成英文 → 借助其他工具生成语音 → 跟读朗读背诵";

const STEPS = [
  "先用母语写下差不多 20～200 字，记录并整理自己想说的话；",
  "使用本 AI 工具将其转换成英文表达；",
  "使用其他 AI 辅助工具将英文文字转换成语音文件；",
  "跟读、朗读，直至完整背诵。",
];

/**
 * 「如何练习」轻量折叠模块：默认收起、只留一行摘要。
 *
 * 整行是一个 <button>（因此天然支持 Enter / Space 与焦点环），aria-expanded +
 * aria-controls 关联下方面板。展开动画只有高度（grid-rows 0fr→1fr）与透明度，
 * 不做弹跳；收起时用 inert 让面板里的外链退出 Tab 序。
 */
export function PracticeGuide() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-md border bg-secondary/30">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left outline-none transition-colors hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-ui-sm font-medium">如何练习</span>
          {!open && (
            <span className="min-w-0 truncate text-ui-xs text-muted-foreground">
              {SUMMARY}
            </span>
          )}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2.5 border-t border-border/60 px-3 py-2.5">
            <ol className="space-y-1 text-ui-sm text-muted-foreground">
              {STEPS.map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="shrink-0 text-faint tabular-nums">
                    {i + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="border-t border-border/60 pt-2 text-ui-xs text-faint">
              该训练思想来自李笑来开源书籍
              <a
                href={PRACTICE_SOURCE_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="mx-0.5 inline-flex items-baseline gap-0.5 underline decoration-dotted underline-offset-2 hover:text-foreground"
              >
                《1000 小时》
                <ExternalLinkIcon
                  aria-hidden
                  className="size-3 self-center opacity-70"
                />
                <span className="sr-only">（在新标签页打开）</span>
              </a>
              。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
