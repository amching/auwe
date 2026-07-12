import { useRef } from "react";
import { cn } from "@/lib/utils";
import { POLISH_LEVELS, type PolishLevel } from "./prompts";

interface PolishScaleProps {
  value: PolishLevel;
  onChange: (level: PolishLevel) => void;
  disabled?: boolean;
}

const clamp = (n: number): PolishLevel =>
  Math.min(5, Math.max(1, n)) as PolishLevel;

/**
 * 「文字美颜刻度」：五档落在同一条水平轨道上，从朴实（左）到浮夸（右）强度递增。
 * 语义上是单选（radiogroup），但视觉上是一条连续刻度而非五个分类按钮。
 * 键盘：←/↓ 减一档，→/↑ 加一档，Home/End 到两端（roving tabindex）。
 */
export function PolishScale({ value, onChange, disabled }: PolishScaleProps) {
  const stopsRef = useRef<(HTMLButtonElement | null)[]>([]);

  function move(next: PolishLevel) {
    onChange(next);
    stopsRef.current[next - 1]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      move(clamp(value - 1));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      move(clamp(value + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      move(1);
    } else if (e.key === "End") {
      e.preventDefault();
      move(5);
    }
  }

  // 已选档位在轨道上的百分比位置（第 1 档 0%，第 5 档 100%），用于填充已达强度。
  const fillPct = ((value - 1) / (POLISH_LEVELS.length - 1)) * 100;

  return (
    <div
      role="radiogroup"
      aria-label="润色程度"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(disabled && "opacity-50")}
    >
      {/* 轨道 + 圆点：五等分栅格，圆点中心即各列中心（首列 10%、尾列 90%） */}
      <div className="relative grid grid-cols-5">
        {/* 轨道底线：从第 1 点中心(10%)连到第 5 点中心(90%) */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-[10%] left-[10%] h-1 -translate-y-1/2 rounded-full bg-border"
        />
        {/* 已达强度填充 */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-[10%] h-1 -translate-y-1/2 rounded-full bg-primary transition-all"
          style={{ width: `calc(80% * ${fillPct / 100})` }}
        />
        {POLISH_LEVELS.map((meta) => {
          const active = meta.level === value;
          const reached = meta.level <= value;
          return (
            // biome-ignore lint/a11y/useSemanticElements: 连续刻度轨道需自定义视觉，原生 radio 无法呈现
            <button
              key={meta.level}
              ref={(el) => {
                stopsRef.current[meta.level - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${meta.level} · ${meta.label}：${meta.hint}`}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(meta.level)}
              className="relative z-10 flex h-6 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
            >
              <span
                className={cn(
                  "rounded-full border bg-background transition-all",
                  active
                    ? "size-4 border-primary ring-2 ring-primary/25"
                    : reached
                      ? "size-3 border-primary bg-primary"
                      : "size-3 border-border-strong",
                )}
              />
            </button>
          );
        })}
      </div>

      {/* 档位标签：与圆点同为五等分栅格，各自居中对齐；选中档加粗高亮 */}
      <div className="mt-1.5 grid grid-cols-5 text-center text-ui-xs">
        {POLISH_LEVELS.map((meta) => {
          const active = meta.level === value;
          return (
            <span
              key={meta.level}
              aria-hidden
              className={cn(
                "transition-colors",
                active ? "font-medium text-primary" : "text-faint",
              )}
            >
              {meta.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
