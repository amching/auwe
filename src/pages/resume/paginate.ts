/**
 * 简历分页引擎（预览用；导出 PDF 仍走浏览器原生打印）。
 *
 * 思路：以一份「隐藏的连续 .resume-paper」（已由 react-markdown + rehype-sanitize 渲染、
 * 固定内容宽 178mm）为唯一事实源，读取它真实布局后的 DOM，按 A4 页内容高 269mm 切页，
 * 尽量贴合浏览器打印的分页行为：
 *   - 顶层块之间、列表 li 之间可断；li 内部不断（等价 break-inside: avoid）。
 *   - 节标题（h1/h2/h3）不落在页尾（等价 break-after: avoid）。
 *   - 连续两条分隔线（Markdown 里 `---` 紧跟 `---`，渲染成相邻 <hr><hr>）＝强制从新页开始，
 *     两条线本身不上纸（等价手写 page-break；中英双版简历各起一页就靠它）。纯 GFM，
 *     不认识这条约定的渲染器只会显示两条细线，平滑降级。
 * 切页只读几何、不改源；页面渲染时把源节点 cloneNode 进各页框——克隆自已 sanitize 的 DOM，
 * 不新开渲染入口，铁律「所有渲染必过 sanitize」仍成立。
 */

/** CSS 参考像素：1mm = 96/25.4 px（与屏幕物理 DPI 无关，屏幕/打印一致）。 */
export const MM_TO_PX = 96 / 25.4;
/** A4 一页内容高：297 − 上下页边距 14mm 各一（见 resume.css @page）。 */
export const PAGE_CONTENT_PX = (297 - 14 * 2) * MM_TO_PX;
/**
 * 分页打包预算：整页内容高再留 2mm 余量。切满到恰好 269mm 的页极脆——mm→px 舍入、
 * 列表中缝拆页时 li 外边距穿透等亚毫米级误差，都可能让打印把页尾最后一块挤到下一页
 * （多出一张近空白页）。2mm（≈7.6px）足以吸收这些误差，肉眼看不出页底少了这点。
 */
export const PAGE_BUDGET_PX = PAGE_CONTENT_PX - 2 * MM_TO_PX;
/** A4 内容宽：210 − 左右页边距 16mm 各一。源与页框都用它，保证折行一致。 */
export const CONTENT_WIDTH_PX = (210 - 16 * 2) * MM_TO_PX;
/** A4 整页尺寸（含页边距），用于页框。 */
export const PAGE_WIDTH_PX = 210 * MM_TO_PX;
export const PAGE_HEIGHT_PX = 297 * MM_TO_PX;

const EPS = 1;
const HEADING = /^H[1-3]$/;

interface Unit {
  /** 源节点：顶层块，或列表里的单个 li。 */
  el: Element;
  kind: "block" | "li";
  /** kind==="li" 时其父 ul/ol，用于跨页时按子集重建列表。 */
  list: Element | null;
  /** 是否节标题：不允许落在页尾。 */
  heading: boolean;
  /** 强制从新页开始（源里此单元前有连续 ≥2 条 <hr>）。 */
  breakBefore: boolean;
  /** 相对源顶端的 border-box 上/下沿（px）。 */
  top: number;
  bottom: number;
}

/**
 * 把源的顶层块摊平成可断单元：列表拆成 li，其余块各为一个单元。
 * 连续 ≥2 条 <hr> 不成为单元（不上纸），折叠成下一个单元的 breakBefore 标记。
 */
function collectUnits(source: HTMLElement): Unit[] {
  const srcTop = source.getBoundingClientRect().top;
  const children = Array.from(source.children);
  const units: Unit[] = [];
  let pendingBreak = false;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const tag = child.tagName;
    if (tag === "HR" && children[i + 1]?.tagName === "HR") {
      while (children[i + 1]?.tagName === "HR") i++; // 吞掉整串 hr
      pendingBreak = true;
      continue;
    }
    if (tag === "UL" || tag === "OL") {
      for (const li of Array.from(child.children)) {
        const r = li.getBoundingClientRect();
        units.push({
          el: li,
          kind: "li",
          list: child,
          heading: false,
          breakBefore: pendingBreak,
          top: r.top - srcTop,
          bottom: r.bottom - srcTop,
        });
        pendingBreak = false;
      }
    } else {
      const r = child.getBoundingClientRect();
      units.push({
        el: child,
        kind: "block",
        list: null,
        heading: HEADING.test(tag),
        breakBefore: pendingBreak,
        top: r.top - srcTop,
        bottom: r.bottom - srcTop,
      });
      pendingBreak = false;
    }
  }
  return units;
}

/**
 * 段数 = 强制分页标记数 + 1。智能一页据此设定目标页数（每段压进一页），
 * 否则含强制分页的简历永远「压不进一页」，二分会直接顶到最紧凑档。
 */
export function countSegments(source: HTMLElement): number {
  return collectUnits(source).filter((u) => u.breakBefore).length + 1;
}

/**
 * 读取源当前布局（即当前 --resume-spacing / --resume-type 下）切页，返回每页的单元序列。
 * 只读几何，不修改源。页数 = 返回数组长度。
 *
 * pageHeightPx 默认整页内容高（269mm）；智能一页判定时传入略小的值留出安全余量，
 * 避免二分收敛到刚好卡边、而浏览器原生打印因舍入多翻出一页（预览说 1 页、PDF 却 2 页）。
 */
export function paginate(
  source: HTMLElement,
  pageHeightPx: number = PAGE_CONTENT_PX,
): Unit[][] {
  const units = collectUnits(source);
  if (units.length === 0) return [];

  const pages: Unit[][] = [];
  let cur: Unit[] = [];
  let pageStart = 0;
  for (const u of units) {
    if (cur.length === 0) {
      pageStart = u.top;
      cur.push(u);
      continue;
    }
    // 强制分页：无条件收页，本单元开新页。
    if (u.breakBefore) {
      pages.push(cur);
      cur = [u];
      pageStart = u.top;
      continue;
    }
    // 单元底沿相对本页起点是否仍在一页内。首个单元无条件放入（超高块允许溢出本页）。
    if (u.bottom - pageStart <= pageHeightPx + EPS) {
      cur.push(u);
    } else {
      pages.push(cur);
      cur = [u];
      pageStart = u.top;
    }
  }
  if (cur.length) pages.push(cur);

  pullTrailingHeadings(pages);
  return pages;
}

/**
 * 把单元推到第 p 页之后：若下一页以强制分页单元开头（属于新段），不能把本段内容混进去，
 * 在中间插一张新页承接。paginateExact 的回退与标题挪移都经此保持段边界不被打破。
 */
function pushForward(pages: Unit[][], p: number, u: Unit): void {
  if (!pages[p + 1] || pages[p + 1][0]?.breakBefore) pages.splice(p + 1, 0, []);
  pages[p + 1].unshift(u);
}

/**
 * 标题不落页尾：把页尾的标题挪到下一页页首（可能连挪多个）。保留≥1个单元，避免空页。
 * 下一页是新段（强制分页）时不挪——段末标题后面本就没有正文可跟，挪了反而孤页。
 */
function pullTrailingHeadings(pages: Unit[][]): void {
  for (let p = 0; p < pages.length - 1; p++) {
    if (pages[p + 1][0]?.breakBefore) continue;
    while (pages[p].length > 1 && pages[p][pages[p].length - 1].heading) {
      const h = pages[p].pop();
      if (h) pages[p + 1].unshift(h);
    }
  }
}

/**
 * 严格分页：先按源几何切页（paginate），再逐页「重建 + 实测」校验。
 *
 * 为什么必须校验：paginate 量的是连续源里各单元的跨度，而 buildPaper 重建页面时
 * 外边距折叠关系在切点处改变（首单元的 margin-top 不再与上一单元折叠、跨页列表重建外壳等），
 * 重建页可比量得的跨度高出十几 px。切满的页会因此溢出 A4 页框——预览里最后一行被下一页
 * 页框盖住、打印时被裁掉（「智能一页后最后一行显示不完整」的根因之一）。
 *
 * 做法：把每页 buildPaper 后放进 178mm 宽的隐藏测量容器实测高度，超出页高就把尾单元推给
 * 下一页（并保持「标题不落页尾」），逐页向后级联，必要时自然多出新页。测量容器用源的父级
 * （即屏外 178mm 包装 div），与真实页框同宽，故实测折行/高度即最终结果。
 */
export function paginateExact(
  source: HTMLElement,
  spacing: number,
  type: number,
  pageHeightPx: number = PAGE_BUDGET_PX,
): Unit[][] {
  const host = source.parentElement;
  const pages = paginate(source, pageHeightPx);
  if (!host) return pages; // 无处测量时退化为几何切页
  for (let p = 0; p < pages.length; p++) {
    let paper = buildPaper(pages[p], spacing, type);
    host.appendChild(paper);
    // 超高就回退尾单元；同时保持标题不落页尾（下一页是新段时段末标题可留）。
    // 回退经 pushForward，不把本段内容混进强制分页开启的新段。保留≥1个单元，避免死循环/空页。
    while (pages[p].length > 1) {
      const tooTall = paper.getBoundingClientRect().height > pageHeightPx + EPS;
      const nextSameSegment =
        p < pages.length - 1 && !pages[p + 1][0]?.breakBefore;
      const trailingHeading =
        nextSameSegment && pages[p][pages[p].length - 1].heading;
      if (!tooTall && !trailingHeading) break;
      const moved = pages[p].pop();
      if (!moved) break;
      pushForward(pages, p, moved);
      host.removeChild(paper);
      paper = buildPaper(pages[p], spacing, type);
      host.appendChild(paper);
    }
    host.removeChild(paper);
  }
  pullTrailingHeadings(pages);
  return pages;
}

/**
 * 把一页的单元克隆重建成 .resume-paper 内容（含正确 --resume-spacing / --resume-type）。
 * 连续同一列表的 li 重新包回一个 ul/ol（跨页时各页各留自己的子集）。
 */
export function buildPaper(
  page: Unit[],
  spacing: number,
  type: number,
): HTMLElement {
  const paper = document.createElement("div");
  paper.className = "resume-paper";
  paper.style.setProperty("--resume-spacing", String(spacing));
  paper.style.setProperty("--resume-type", String(type));

  let i = 0;
  while (i < page.length) {
    const u = page[i];
    if (u.kind === "li" && u.list) {
      const list = u.list;
      const shell = list.cloneNode(false) as HTMLElement; // 浅克隆 <ul>/<ol> 外壳
      while (
        i < page.length &&
        page[i].kind === "li" &&
        page[i].list === list
      ) {
        shell.appendChild(page[i].el.cloneNode(true));
        i++;
      }
      paper.appendChild(shell);
    } else {
      paper.appendChild(u.el.cloneNode(true));
      i++;
    }
  }
  return paper;
}
