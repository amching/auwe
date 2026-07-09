import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import Markdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { sanitizeSchema } from "@/lib/markdown/sanitize";
// 自带 Noto Sans SC（OFL，可嵌入 PDF）：跨 macOS/Windows/Linux 一致渲染+打印中文/日文假名/拉丁。
// Fontsource 按 unicode-range 切片，浏览器只下载简历实际用到的字。仅简历页 chunk 加载。
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/600.css";
import {
  buildPaper,
  CONTENT_WIDTH_PX,
  MM_TO_PX,
  PAGE_CONTENT_PX,
  PAGE_WIDTH_PX,
  paginate,
} from "./paginate";
import "./resume.css";

/** 间距压缩下限：低于此值行距/留白过挤。字号永远不动（见 resume.css）。 */
const SPACING_FLOOR = 0.55;
/**
 * 智能一页判定的安全余量：只有内容落进「整页高 − 4mm」才算压进一页。
 * 留这点头寸给浏览器原生打印的舍入差，保证预览的「1 页」在导出 PDF 时也是 1 页。
 */
const FIT_TARGET_PX = PAGE_CONTENT_PX - 4 * MM_TO_PX;

/**
 * 条目标题 H3：以最后一个 `|` 拆成「左标题 / 右时间」两端对齐。
 * 平滑降级：children 含复杂内联节点（粗体/链接等）或没有 `|` 时原样渲染。
 */
function ResumeH3({ children }: { children?: ReactNode }) {
  const nodes = Children.toArray(children);
  const allText = nodes.every((n) => typeof n === "string");
  if (allText) {
    const text = nodes.join("");
    const idx = text.lastIndexOf("|");
    if (idx !== -1) {
      const left = text.slice(0, idx).trim();
      const right = text.slice(idx + 1).trim();
      return (
        <h3 className="resume-entry-head">
          <span>{left}</span>
          <span className="resume-entry-time">{right}</span>
        </h3>
      );
    }
  }
  return <h3>{children}</h3>;
}

const components: Components = { h3: ResumeH3 };

export interface ResumeLayoutInfo {
  /** 分页后的物理页数（所见即所得）。 */
  pageCount: number;
  /** 开了智能一页但仍压不进一页：内容太多，建议精简。 */
  overflow: boolean;
}

interface ResumePreviewProps {
  markdown: string;
  /** 智能一页开关：开 → 收紧间距（不改字号）尽量压进一页。 */
  autoFit: boolean;
  /** 每次重新分页后回报页数/溢出，供工作台头部显示。 */
  onLayout?: (info: ResumeLayoutInfo) => void;
}

/**
 * 简历预览：真分页 + 缩放适配。
 *
 * - 隐藏的连续 `.resume-paper#resume-print-source` 是唯一事实源：react-markdown + rehype-sanitize
 *   渲染一次（铁律），固定内容宽 178mm。既供测量分页，也供 usePrintResume 克隆打印。
 * - 可见区是 N 个 A4 页框，用 paginate/buildPaper 把源节点克隆分配进去 → 与打印分页基本一致，
 *   末页留白也如实呈现。
 * - 整个页栈用 transform: scale 适配面板宽度；内容始终按真实 178mm 折行，故预览折行=打印折行。
 * - 智能一页：在 [FLOOR,1] 内二分收紧 --resume-spacing，找能让页数=1 的最大值（最少压缩）；
 *   压不进则停在下限并回报 overflow。全程不改字号。
 */
export function ResumePreview({
  markdown,
  autoFit,
  onLayout,
}: ResumePreviewProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  // 缩放适配：把 210mm 页栈缩到面板宽，居中，并按缩放后高度撑起滚动区。
  const applyZoom = useCallback(() => {
    const wrap = wrapRef.current;
    const scaler = scalerRef.current;
    const host = hostRef.current;
    if (!wrap || !scaler || !host) return;
    const z = Math.min(1, wrap.clientWidth / PAGE_WIDTH_PX);
    scaler.style.transform = `scale(${z})`;
    scaler.style.left = `${Math.max(0, (wrap.clientWidth - PAGE_WIDTH_PX * z) / 2)}px`;
    wrap.style.height = `${host.scrollHeight * z}px`;
  }, []);

  // 选定间距系数：智能一页时二分求「能压进一页的最大 spacing」，否则 1。只读几何、不改字号。
  const chooseSpacing = useCallback(
    (source: HTMLElement): number => {
      // 判定用带安全余量的目标高度（见 FIT_TARGET_PX），避免卡边导致打印多翻一页。
      const fitsOnePage = (s: number) => {
        source.style.setProperty("--resume-spacing", String(s));
        return paginate(source, FIT_TARGET_PX).length <= 1;
      };
      if (!autoFit || fitsOnePage(1)) return 1;
      if (!fitsOnePage(SPACING_FLOOR)) return SPACING_FLOOR; // 压到底仍不止一页
      let lo = SPACING_FLOOR; // 已知能进一页
      let hi = 1; // 已知进不了一页
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (fitsOnePage(mid)) lo = mid;
        else hi = mid;
      }
      return lo;
    },
    [autoFit],
  );

  // 分页 + 建页框。测量必须在字体加载后（CJK 切片改变高度），故 fonts.ready 后再跑一次。
  const relayout = useCallback(() => {
    const source = sourceRef.current;
    const host = hostRef.current;
    if (!source || !host) return;

    const spacing = chooseSpacing(source);
    source.style.setProperty("--resume-spacing", String(spacing));
    const pages = paginate(source);

    host.replaceChildren();
    for (const page of pages) {
      const frame = document.createElement("div");
      frame.className = "resume-page";
      frame.appendChild(buildPaper(page, spacing));
      host.appendChild(frame);
    }

    applyZoom();
    onLayout?.({
      pageCount: pages.length,
      overflow: autoFit && pages.length > 1,
    });
  }, [autoFit, chooseSpacing, applyZoom, onLayout]);

  // markdown 变化经 react-markdown 改源 DOM 后需重排（它不被 relayout 直接读取，仅作触发器）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: markdown 是重排触发器而非直接依赖
  useLayoutEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) relayout();
    };
    run();
    if (document.fonts?.ready) {
      document.fonts.ready.then(run);
    }
    return () => {
      cancelled = true;
    };
    // markdown 变化经 react-markdown 改动源 DOM 后需重新分页（源节点非直接依赖，靠它触发）。
  }, [relayout, markdown]);

  // 面板宽度变化 → 只重算缩放，不必重新分页。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => applyZoom());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [applyZoom]);

  return (
    <>
      {/*
       * 隐藏连续源（唯一事实源）：屏外定位但仍参与布局以供测量；固定内容宽 178mm。
       * #resume-print-source 供 usePrintResume 克隆打印；--resume-spacing 由 relayout 写在其上。
       */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "-99999px",
          top: 0,
          width: `${CONTENT_WIDTH_PX}px`,
          pointerEvents: "none",
        }}
      >
        <div id="resume-print-source" ref={sourceRef} className="resume-paper">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
            components={components}
          >
            {markdown}
          </Markdown>
        </div>
      </div>

      {/* 可见页栈：缩放适配面板宽（内容仍按 178mm 折行）。 */}
      <div ref={wrapRef} className="resume-pages-wrap">
        <div
          ref={scalerRef}
          className="resume-pages-scaler"
          style={{ width: `${PAGE_WIDTH_PX}px` }}
        >
          <div ref={hostRef} className="resume-pages" />
        </div>
      </div>
    </>
  );
}
