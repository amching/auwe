import { ChevronsUpDownIcon } from "lucide-react";
import { useMemo } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { formatOffset, getTimeZoneOffsetMinutes } from "./timezone";

interface TimeZoneSelectProps {
  value: string;
  onValueChange: (zone: string) => void;
  zones: string[];
  /** 用于计算各选项当前 UTC 偏移、并据此排序的参照时刻（ms）。 */
  referenceMs: number;
  id?: string;
  ariaLabel: string;
  className?: string;
}

/**
 * 可搜索的时区选择器（复用 shadcn Combobox 组件）。正/反向两处共用。
 * 列表按当前 UTC 偏移排序（UTC−→UTC+），并在右侧显示偏移；偏移随夏令时变化。
 */
export function TimeZoneSelect({
  value,
  onValueChange,
  zones,
  referenceMs,
  id,
  ariaLabel,
  className,
}: TimeZoneSelectProps) {
  // 参照时刻变化时才重算偏移与排序（非每次过滤/渲染）。
  const { sorted, offsetLabels } = useMemo(() => {
    const mins = new Map<string, number>();
    for (const z of zones)
      mins.set(z, getTimeZoneOffsetMinutes(referenceMs, z));
    const sorted = [...zones].sort(
      (a, b) => (mins.get(a) ?? 0) - (mins.get(b) ?? 0) || a.localeCompare(b),
    );
    const offsetLabels = new Map<string, string>();
    for (const z of zones) offsetLabels.set(z, formatOffset(mins.get(z) ?? 0));
    return { sorted, offsetLabels };
  }, [zones, referenceMs]);

  return (
    <Combobox
      items={sorted}
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
      itemToStringLabel={(zone) => String(zone)}
      // 打开时把已选时区滚动到可视中部（否则长列表总是从顶部开始）。
      onOpenChange={(open) => {
        if (!open) return;
        requestAnimationFrame(() => {
          document
            .querySelector(
              '[data-slot="combobox-content"] [data-slot="combobox-item"][data-selected]',
            )
            ?.scrollIntoView({ block: "center" });
        });
      }}
      // 归一化 `/` `_` 与空格，让「new york」也能匹配「America/New_York」。
      filter={(zone, query) => {
        const q = query
          .trim()
          .toLowerCase()
          .replace(/[\s/_]+/g, " ");
        if (!q) return true;
        return String(zone).toLowerCase().replace(/[/_]+/g, " ").includes(q);
      }}
    >
      <div className={cn("relative", className)}>
        <ComboboxInput
          id={id}
          aria-label={ariaLabel}
          placeholder="搜索时区…"
          className="pr-8 font-mono"
        />
        <ChevronsUpDownIcon className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>

      <ComboboxContent>
        <ComboboxEmpty>未找到时区</ComboboxEmpty>
        <ComboboxList>
          {(zone: string, index: number) => (
            <ComboboxItem key={zone} value={zone} index={index}>
              <span className="font-mono">{zone}</span>
              <span className="ml-auto shrink-0 pl-6 font-mono text-ui-xs text-faint tabular-nums">
                {offsetLabels.get(zone)}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
