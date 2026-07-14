import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * 工具条上的紧凑单选下拉：只显示当前选中项，点开向上弹出选项菜单。
 * 选项多（≥3）时比分段控件省地方，用在底部浮动工具条里。
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
  /** 无障碍名（工具条上不渲染文字标签） */
  label: string;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 rounded-full font-medium"
            aria-label={label}
            title={label}
          >
            {current?.label ?? value}
            <ChevronDownIcon className="size-3.5 text-faint" />
          </Button>
        }
      />
      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={10}
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
