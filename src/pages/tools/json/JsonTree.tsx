import { ChevronRightIcon } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { FlatRow, JsonNode, Matcher, SearchSettings } from "./model";

/** 行高（px）：虚拟化按固定行高窗口切片，改这里需同步行内 style。 */
const ROW_HEIGHT = 26;
/** 视口外上下各多渲染的行数，快速滚动不露白。 */
const OVERSCAN = 12;
/** 每层缩进（px）。 */
const INDENT = 18;

const VALUE_CLASS: Record<string, string> = {
  string: "text-success",
  number: "text-info",
  boolean: "text-warning",
  null: "text-faint",
};

/** 命中片段高亮：把 matcher 的区间切成 <mark>。 */
function Highlighted({
  text,
  matcher,
}: {
  text: string;
  matcher: Matcher | null;
}) {
  if (!matcher) return <>{text}</>;
  const ranges = matcher.ranges(text);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  ranges.forEach(([from, to], i) => {
    if (from > last) parts.push(text.slice(last, from));
    parts.push(
      // biome-ignore lint/suspicious/noArrayIndexKey: 区间序即身份，无重排
      <mark key={i} className="rounded-[2px] bg-warning/25 text-inherit">
        {text.slice(from, to)}
      </mark>,
    );
    last = Math.max(last, to);
  });
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

interface RowProps {
  row: FlatRow;
  top: number;
  keyMatcher: Matcher | null;
  valueMatcher: Matcher | null;
  onToggle: (node: JsonNode, expanded: boolean) => void;
}

const Row = memo(function Row({
  row,
  top,
  keyMatcher,
  valueMatcher,
  onToggle,
}: RowProps) {
  const { node, kind, expanded } = row;
  const isContainer = node.type === "object" || node.type === "array";
  const brackets = node.type === "array" ? "[]" : "{}";
  const toggleable = kind === "open" && isContainer && node.childCount > 0;

  const label =
    node.key !== null ? (
      <span className="text-foreground">
        "
        <Highlighted text={node.key} matcher={keyMatcher} />"
        <span className="text-muted-foreground">: </span>
      </span>
    ) : node.index !== null ? (
      <span className="text-faint">{node.index}: </span>
    ) : null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 行级点击只是鼠标快捷区，键盘/读屏走 chevron 按钮
    // biome-ignore lint/a11y/useKeyWithClickEvents: 同上——chevron 按钮可聚焦并承担键盘开关
    <div
      className={cn(
        "absolute right-0 left-0 flex items-center gap-0 truncate pr-3 leading-none whitespace-pre",
        toggleable && "cursor-pointer hover:bg-muted/60",
      )}
      style={{ top, height: ROW_HEIGHT, paddingLeft: 8 + node.depth * INDENT }}
      onClick={toggleable ? () => onToggle(node, expanded) : undefined}
    >
      {/* chevron 槽位固定宽度，保证同层对齐 */}
      <span className="flex w-[18px] shrink-0 items-center justify-center">
        {toggleable && (
          <button
            type="button"
            aria-label={expanded ? "折叠" : "展开"}
            aria-expanded={expanded}
            className="flex size-4 items-center justify-center rounded text-faint outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node, expanded);
            }}
          >
            <ChevronRightIcon
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>
        )}
      </span>

      {kind === "close" ? (
        <span className="text-muted-foreground">{brackets[1]}</span>
      ) : isContainer ? (
        <>
          {label}
          <span className="text-muted-foreground">
            {expanded
              ? brackets[0]
              : node.childCount > 0
                ? `${brackets[0]} … ${brackets[1]}`
                : brackets}
          </span>
          {!expanded && (
            <span className="ml-2 shrink-0 rounded-full bg-muted px-1.5 py-px font-sans text-ui-xs text-muted-foreground">
              {node.childCount} 项
            </span>
          )}
        </>
      ) : (
        <>
          {label}
          <span className={VALUE_CLASS[node.type]}>
            {node.type === "string" ? (
              <>
                "
                <Highlighted text={node.text} matcher={valueMatcher} />"
              </>
            ) : (
              <Highlighted text={node.text} matcher={valueMatcher} />
            )}
          </span>
        </>
      )}
    </div>
  );
});

interface JsonTreeProps {
  rows: FlatRow[];
  matcher: Matcher | null;
  settings: SearchSettings;
  onToggle: (node: JsonNode, expanded: boolean) => void;
  className?: string;
}

/**
 * 虚拟化 JSON 树：固定行高 + 窗口切片渲染，十万行级文档依然流畅。
 * 行数据由 model.flattenVisible 产出（只含当前可见行）。
 */
export function JsonTree({
  rows,
  matcher,
  settings,
  onToggle,
  className,
}: JsonTreeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN,
  );
  const keyMatcher = settings.matchKeys ? matcher : null;
  const valueMatcher = settings.matchValues ? matcher : null;

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className={cn(
        "scroll-subtle h-full overflow-auto py-2 font-mono text-ui-sm",
        className,
      )}
    >
      <div
        className="relative"
        style={{ height: rows.length * ROW_HEIGHT + 56 /* 底部工具条余量 */ }}
      >
        {rows.slice(start, end).map((row, i) => (
          <Row
            key={`${row.kind}:${row.node.path}`}
            row={row}
            top={(start + i) * ROW_HEIGHT}
            keyMatcher={keyMatcher}
            valueMatcher={valueMatcher}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}
