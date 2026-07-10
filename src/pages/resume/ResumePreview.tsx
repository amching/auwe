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
  countSegments,
  MM_TO_PX,
  PAGE_CONTENT_PX,
  PAGE_WIDTH_PX,
  paginateExact,
} from "./paginate";
import "./resume.css";
import type { ResumeTemplateId } from "./templates";
import "./templates.css";

/** 间距压缩下限：低于此值行距/留白过挤。 */
const SPACING_FLOOR = 0.55;
/**
 * 智能一页判定的安全余量：只有内容落进「整页高 − 4mm」才算压进一页。
 * 留这点头寸给浏览器原生打印的舍入差，保证预览的「1 页」在导出 PDF 时也是 1 页。
 */
const FIT_TARGET_PX = PAGE_CONTENT_PX - 4 * MM_TO_PX;

/**
 * 「智能一页」压缩路径：单调标量 fit ∈ [0,1]，0=舒适（默认），1=最紧凑。
 * 先收紧间距、再缩字号（都在标准区间内），符合“先压留白再动字”的排版直觉：
 *   fit 0→SPLIT：--resume-spacing 从 1 收到 SPACING_FLOOR，字号档位保持舒适；
 *   fit SPLIT→1：间距已到底，--resume-type 从 1（舒适）降到 0（紧凑）。
 * 页高随 fit 单调不增，故可二分求“能压进一页的最小 fit”（即最舒适的可行解）。
 */
const FIT_SPLIT = 0.6;
function varsForFit(fit: number): { spacing: number; type: number } {
  if (fit <= FIT_SPLIT) {
    return { spacing: 1 - (1 - SPACING_FLOOR) * (fit / FIT_SPLIT), type: 1 };
  }
  return {
    spacing: SPACING_FLOOR,
    type: 1 - (fit - FIT_SPLIT) / (1 - FIT_SPLIT),
  };
}

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
  /** 开了智能一页但仍压不进目标页数（每个强制分页段各一页）：内容太多，建议精简。 */
  overflow: boolean;
  /** 实际内容字数：从渲染后的可见文本计，已排除注释 / Markdown 语法 / 链接 URL。 */
  charCount: number;
  /** 章节数 = 渲染出的 H2 个数。 */
  sectionCount: number;
}

/**
 * 简历实际字数：中英混排按 Word「字数统计」口径——CJK 逐字计 1，英文/数字按「词」（连续
 * 字母数字串）计 1，标点与空白不计。输入应是渲染后的可见文本（textContent），
 * 因此天然不含 HTML 注释、`#`/`-`/`**`/`|` 等语法符号、以及链接的 URL。
 */
function countContent(text: string): number {
  // 一-鿿 汉字 / 㐀-䶿 扩展A / ぀-ヿ 日文假名
  const cjk = (text.match(/[㐀-䶿一-鿿぀-ヿ]/g) ?? []).length;
  const words = (text.match(/[A-Za-z0-9]+/g) ?? []).length;
  return cjk + words;
}

interface ResumePreviewProps {
  markdown: string;
  /** 智能一页开关：开 → 先收紧间距、再在标准区间内缩字号，尽量压进一页。 */
  autoFit: boolean;
  /** 视觉模板 id：写成容器的 data-resume-template，templates.css 据此作用域化配色与版式细则。 */
  template: ResumeTemplateId;
  /** 每次重新分页后回报页数/溢出/字数/章节数（均基于渲染后的实际内容），供工作台显示。 */
  onLayout?: (info: ResumeLayoutInfo) => void;
}

/**
 * 简历预览：真分页 + 缩放适配。
 *
 * - 隐藏的连续 `.resume-paper#resume-print-source` 是唯一事实源：react-markdown + rehype-sanitize
 *   渲染一次（铁律），固定内容宽 178mm，供 paginate 测量分页。
 * - 可见区是 N 个 A4 页框，用 paginateExact/buildPaper 把源节点克隆分配进去（重建实测校验，
 *   保证每页 ≤ 页高）；usePrintResume 打印时克隆的正是这些页框（而非连续源），故打印分页与
 *   预览逐页一致，末页留白也如实呈现。
 * - 整个页栈用 transform: scale 适配面板宽度；内容始终按真实 178mm 折行，故预览折行=打印折行。
 * - 智能一页：沿 fit 路径（先收紧间距、再在标准区间内缩字号，见 varsForFit）二分求能压进
 *   目标页数（= 段数，见 countSegments；无强制分页即 1 页）的最舒适一组；压到最紧凑仍超标
 *   则回报 overflow，交给头部提示精简。
 */
export function ResumePreview({
  markdown,
  autoFit,
  template,
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

  // 选定压缩档位 fit：智能一页时二分求「能压进目标页数的最小 fit」（最舒适的可行解），否则 0。
  // 目标页数 = 段数（强制分页把简历分成几段就几页，如中英双版各一页；无强制分页即 1 页）。
  // 判定用「重建实测」的严格分页（paginateExact）+ 带安全余量的目标高度（FIT_TARGET_PX），
  // 避免收敛到重建后实际超高、或卡边导致原生打印多翻一页的档位。
  const chooseFit = useCallback(
    (source: HTMLElement, segments: number): number => {
      const fits = (fit: number) => {
        const { spacing, type } = varsForFit(fit);
        source.style.setProperty("--resume-spacing", String(spacing));
        source.style.setProperty("--resume-type", String(type));
        return (
          paginateExact(source, spacing, type, FIT_TARGET_PX).length <= segments
        );
      };
      if (!autoFit || fits(0)) return 0; // 舒适档已达标（或未开）
      if (!fits(1)) return 1; // 压到最紧凑仍超目标页数
      let lo = 0; // 已知不达标
      let hi = 1; // 已知达标
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) hi = mid;
        else lo = mid;
      }
      return hi; // 最小的可行 fit = 最舒适
    },
    [autoFit],
  );

  // 分页 + 建页框。测量必须在字体加载后（CJK 切片改变高度），故 fonts.ready 后再跑一次。
  const relayout = useCallback(() => {
    const source = sourceRef.current;
    const host = hostRef.current;
    if (!source || !host) return;

    // 段数由源结构决定（连续两条 --- ＝ 强制分页），与压缩档位无关，算一次即可。
    const segments = countSegments(source);
    const { spacing, type } = varsForFit(chooseFit(source, segments));
    source.style.setProperty("--resume-spacing", String(spacing));
    source.style.setProperty("--resume-type", String(type));
    // 严格分页：重建实测校验，保证每页重建后 ≤ 页高（预览不压线、打印不裁行）。
    const pages = paginateExact(source, spacing, type);

    host.replaceChildren();
    for (const page of pages) {
      const frame = document.createElement("div");
      frame.className = "resume-page";
      frame.appendChild(buildPaper(page, spacing, type));
      host.appendChild(frame);
    }

    applyZoom();
    onLayout?.({
      pageCount: pages.length,
      overflow: autoFit && pages.length > segments,
      charCount: countContent(source.textContent ?? ""),
      sectionCount: source.querySelectorAll("h2").length,
    });
  }, [autoFit, chooseFit, applyZoom, onLayout]);

  // markdown 变化经 react-markdown 改源 DOM、template 变化经 data 属性改作用域样式（字距/
  // 胶囊/引用块都影响高度），之后都需重排（二者不被 relayout 直接读取，仅作触发器）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: markdown/template 是重排触发器而非直接依赖
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
  }, [relayout, markdown, template]);

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
       * 隐藏连续源（唯一事实源）：屏外定位但仍参与布局以供 paginate 测量；固定内容宽 178mm。
       * --resume-spacing / --resume-type 由 relayout 写在其上。打印克隆的是下方可见页框，非此连续源。
       *
       * data-resume-template：模板配色作用域（templates.css 按它定义 --paper-* token），挂在
       * 源包装与页栈包装两个容器上，靠继承下发——页框/纸的克隆（paginate/buildPaper）无须携带。
       */}
      <div
        aria-hidden
        data-resume-template={template}
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
      <div
        ref={wrapRef}
        className="resume-pages-wrap"
        data-resume-template={template}
      >
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
