import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * 编辑器悬浮工具栏的「格 + 芯片」结构：
 * 外层卡片（rounded-panel + 通高分隔线）里，每个操作是一个撑满格子的
 * button（cell，整格可点击），视觉反馈落在内嵌的小圆角芯片（chip）上——
 * hover 淡灰、按下加深、展开/弹层打开时用主色低透明度 tint，焦点环画在芯片上。
 */
export const toolbarCellClass =
  "group/seg flex items-stretch p-1 outline-none select-none";

export const toolbarChipClass = cn(
  "flex h-7 items-center justify-center gap-1 rounded-md px-2",
  "text-ui-sm font-medium whitespace-nowrap transition-colors",
  "group-hover/seg:bg-muted group-active/seg:bg-accent",
  "group-aria-expanded/seg:bg-primary/10 group-aria-expanded/seg:text-primary",
  "group-focus-visible/seg:ring-2 group-focus-visible/seg:ring-ring/50",
);

/**
 * 工具条上的紧凑单选下拉：只显示当前选中项，点开向上弹出选项菜单。
 * 触发器是一个工具栏格子；放进外层卡片使用（单独一格或组合工具栏的首格）。
 */
export function ToolbarSelect<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  /** tooltip 文案（按钮可见文字是当前选中项，读屏直接读它） */
  label: string;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" title={label} className={toolbarCellClass}>
            <span className={toolbarChipClass}>
              {current?.label ?? value}
              <ChevronDownIcon className="size-3.5 text-faint transition-transform group-aria-expanded/seg:rotate-180 group-aria-expanded/seg:text-primary" />
            </span>
          </button>
        }
      />
      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-auto min-w-36"
      >
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as T)}
        >
          {options.map((o) => (
            // Base UI 的 RadioItem 默认选中后不关菜单；单选下拉要选完即关
            <DropdownMenuRadioItem key={o.value} value={o.value} closeOnClick>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
