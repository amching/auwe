/**
 * 简历分页引擎（预览用；导出 PDF 仍走浏览器原生打印）。
 *
 * 思路：以一份「隐藏的连续 .resume-paper」（已由 react-markdown + rehype-sanitize 渲染、
 * 固定内容宽 178mm）为唯一事实源，读取它真实布局后的 DOM，按 A4 页内容高 269mm 切页，
 * 尽量贴合浏览器打印的分页行为：
 *   - 顶层块之间、列表 li 之间可断；li 内部不断（等价 break-inside: avoid）。
 *   - 节标题（h1/h2/h3）不落在页尾（等价 break-after: avoid）。
 * 切页只读几何、不改源；页面渲染时把源节点 cloneNode 进各页框——克隆自已 sanitize 的 DOM，
 * 不新开渲染入口，铁律「所有渲染必过 sanitize」仍成立。
 */

/** CSS 参考像素：1mm = 96/25.4 px（与屏幕物理 DPI 无关，屏幕/打印一致）。 */
export const MM_TO_PX = 96 / 25.4;
/** A4 一页内容高：297 − 上下页边距 14mm 各一（见 resume.css @page）。 */
export const PAGE_CONTENT_PX = (297 - 14 * 2) * MM_TO_PX;
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
  /** 相对源顶端的 border-box 上/下沿（px）。 */
  top: number;
  bottom: number;
}

/** 把源的顶层块摊平成可断单元：列表拆成 li，其余块各为一个单元。 */
function collectUnits(source: HTMLElement): Unit[] {
  const srcTop = source.getBoundingClientRect().top;
  const units: Unit[] = [];
  for (const child of Array.from(source.children)) {
    const tag = child.tagName;
    if (tag === "UL" || tag === "OL") {
      for (const li of Array.from(child.children)) {
        const r = li.getBoundingClientRect();
        units.push({
          el: li,
          kind: "li",
          list: child,
          heading: false,
          top: r.top - srcTop,
          bottom: r.bottom - srcTop,
        });
      }
    } else {
      const r = child.getBoundingClientRect();
      units.push({
        el: child,
        kind: "block",
        list: null,
        heading: HEADING.test(tag),
        top: r.top - srcTop,
        bottom: r.bottom - srcTop,
      });
    }
  }
  return units;
}

/**
 * 读取源当前布局（即当前 --resume-spacing 下）切页，返回每页的单元序列。
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

  // 标题不落页尾：把页尾的标题挪到下一页页首（可能连挪多个）。保留≥1个单元，避免空页。
  for (let p = 0; p < pages.length - 1; p++) {
    while (pages[p].length > 1 && pages[p][pages[p].length - 1].heading) {
      const h = pages[p].pop();
      if (h) pages[p + 1].unshift(h);
    }
  }
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
