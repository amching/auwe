import type { EditorView } from "@uiw/react-codemirror";
import { SparklesIcon } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { QUICK_ACTIONS } from "./prompts";

// 浮动工具条上的三个直达指令（面板四个快捷指令的子集，用更短的动词态 label）。
const TOOLBAR_ACTIONS = [
  { label: "精简", instruction: QUICK_ACTIONS[0].instruction },
  { label: "更专业", instruction: QUICK_ACTIONS[1].instruction },
  { label: "强化成果", instruction: QUICK_ACTIONS[2].instruction },
];

interface SelectionToolbarProps {
  view: EditorView | null;
  /** 编辑器面板容器（position: relative），工具条相对它绝对定位。 */
  container: HTMLElement | null;
  selection: { from: number; to: number } | null;
  disabled: boolean;
  /** instruction 为 null 表示只打开面板（「AI 优化」），否则直接发起该指令。 */
  onAction: (instruction: string | null) => void;
}

/**
 * 选中文字后出现在选区上方的轻量工具条。
 * 文档坐标 → 容器坐标换算；选区顶出视口或被清除即隐藏；
 * 选择动作延迟 200ms 出现，避免拖拽划选途中闪烁。
 */
export function SelectionToolbar({
  view,
  container,
  selection,
  disabled,
  onAction,
}: SelectionToolbarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [settled, setSettled] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // 编辑器滚动时 +1，触发位置重算。
  const [tick, setTick] = useState(0);

  const active = selection !== null && !disabled;

  // 选区变化后静置 200ms 再显示，拖选途中不打扰。
  useEffect(() => {
    setSettled(false);
    if (selection === null || disabled) return;
    const timer = setTimeout(() => setSettled(true), 200);
    return () => clearTimeout(timer);
  }, [selection, disabled]);

  useEffect(() => {
    if (!active || !view) return;
    const onScroll = () => setTick((t) => t + 1);
    view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });
    return () => view.scrollDOM.removeEventListener("scroll", onScroll);
  }, [active, view]);

  useLayoutEffect(() => {
    // tick 只为触发重算（编辑器滚动时选区坐标会变）。
    void tick;
    const bar = barRef.current;
    if (!active || !settled || !view || !container || !bar || !selection) {
      setPos(null);
      return;
    }
    const head = view.coordsAtPos(selection.from);
    const anchor = view.coordsAtPos(selection.to);
    if (!head || !anchor) {
      setPos(null);
      return;
    }
    const box = container.getBoundingClientRect();
    const barW = bar.offsetWidth;
    const barH = bar.offsetHeight;
    const gap = 6;

    let top = head.top - box.top - barH - gap;
    // 上方放不下就贴到选区下方。
    if (top < 4) top = anchor.bottom - box.top + gap;
    const left = Math.min(
      Math.max(4, head.left - box.left),
      Math.max(4, box.width - barW - 4),
    );
    setPos({ top, left });
  }, [active, settled, selection, tick, view, container]);

  if (!active || !settled) return null;

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="选中内容的 AI 操作"
      className="absolute z-20 flex items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-panel duration-150 animate-in fade-in-0"
      style={
        pos
          ? { top: pos.top, left: pos.left }
          : { top: -9999, left: -9999, visibility: "hidden" }
      }
    >
      <ToolbarButton onClick={() => onAction(null)} emphasis>
        <SparklesIcon aria-hidden className="size-3" />
        AI 优化
      </ToolbarButton>
      <span aria-hidden className="h-3.5 w-px bg-border" />
      {TOOLBAR_ACTIONS.map((a) => (
        <ToolbarButton key={a.label} onClick={() => onAction(a.instruction)}>
          {a.label}
        </ToolbarButton>
      ))}
    </div>
  );
}

function ToolbarButton({
  onClick,
  emphasis,
  children,
}: {
  onClick: () => void;
  emphasis?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      // mousedown 阻止默认，避免点击瞬间编辑器失焦、选区高亮消失。
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        emphasis
          ? "flex items-center gap-1 rounded-md px-2 py-1 text-ui-xs font-medium text-primary transition-colors hover:bg-primary/10"
          : "rounded-md px-2 py-1 text-ui-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}
