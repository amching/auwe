import { cn } from "@/lib/utils";

/** 工具区共享的分段单选控件（工具条/设置弹层内用，避免弹层套弹层）。 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid auto-cols-fr grid-flow-col rounded-md bg-muted p-0.5 text-ui-xs",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[5px] px-2 py-1 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            value === o.value
              ? "bg-card font-medium text-foreground shadow-panel"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
