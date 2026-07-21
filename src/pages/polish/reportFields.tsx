import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 左侧带标题 + 说明的输入分区（周报 / 季度汇报共用）。 */
export function Field({
  title,
  hint,
  optional,
  children,
}: {
  title: string;
  hint: string;
  optional?: boolean;
  children: ReactNode;
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

/** 可折叠的可选分区（标题点击展开/收起）。展开态由父组件控制，便于「已填内容则保持展开」。 */
export function CollapsibleSection({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <ChevronDown
          className={cn(
            "size-3.5 text-faint transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
        <span className="text-ui-sm font-medium">{title}</span>
        <span className="text-ui-xs text-faint">（可选）</span>
      </button>
      {open && (
        <div className="space-y-1 pl-5">
          {hint && <p className="text-ui-xs text-faint">{hint}</p>}
          {children}
        </div>
      )}
    </div>
  );
}
