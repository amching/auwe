import { useCallback, useEffect } from "react";
import { exportBaseName } from "./exportName";

/**
 * 简历 PDF 导出：浏览器原生打印（不用 html2canvas / jsPDF，保证文字可选中可搜索）。
 *
 * 克隆的是**预览已经分好的页框**（.resume-pages 里每页的 .resume-paper），每页之间插入强制
 * 分页（break-before: page），而不是克隆连续源让浏览器自己重新分页。这样打印与预览用的是同一套
 * 分页结果——所见即所得。
 *
 * 为什么不再让浏览器原生分页：屏幕渲染会把行盒对齐到设备像素（每行量到的高度略偏大），我们的
 * 分页引擎（paginate.ts）读的是屏幕几何，于是比浏览器原生分页断得更早；而浏览器打印连续源时按
 * 打印分辨率排版、每页能多塞两三行 → 预览与 PDF 的断页位置差两三行。改成打印预览页框后，因为屏幕
 * 一贯量得偏高，每个页框的内容打印时只会更矮、绝不会溢出本页，故页数与断点与预览逐页一致。
 *
 * 每个 .resume-paper 自带 relayout/buildPaper 写入的 inline --resume-spacing / --resume-type，
 * cloneNode 时一并带走 → 打印字号/间距与预览一致。克隆的是已过 rehype-sanitize 的 DOM，不新开
 * 渲染入口，铁律「所有渲染必过 sanitize」仍成立。
 *
 * 把页框克隆进 body 直下的 #print-root，@media print（resume.css 内）隐藏 body 下除 #print-root
 * 外的一切（含下拉/弹层 portal），再 window.print()。挂在 body 直下 + 打印时隐藏其余节点，使打印
 * 内容不受工作台祖先 overflow/transform 影响，也不被残留 portal 撑宽而触发打印缩放。
 *
 * 两条入口——导出按钮与 ⌘P/Ctrl+P 拦截——走同一个 print()。
 */
export function usePrintResume() {
  const print = useCallback(async () => {
    // 预览已建好的分页页框（唯一事实源：所见即所得）。
    const papers = document.querySelectorAll<HTMLElement>(
      ".resume-pages > .resume-page > .resume-paper",
    );
    if (papers.length === 0) return;

    let host = document.getElementById("print-root");
    if (!host) {
      host = document.createElement("div");
      host.id = "print-root";
      document.body.appendChild(host);
    }
    // 逐页克隆页框内容，每页装进一个「恰好一页内容高（269mm）」的 .resume-print-page 盒子里
    // （见 resume.css）：固定高 + break-after:page 把每个页框钉死成一张物理页，浏览器无法再
    // 合并/回流，故打印断点与预览逐页一致。盒内纸上的 transform: scale(0.9999)（也在 resume.css，
    // 三个坑见彼处注释）让打印沿用屏幕的小数几何——否则 Chromium 打印会逐行取整、内容比预览
    // 高约 8%，页底最后一行会被挤出页外。
    host.replaceChildren();
    for (const paper of papers) {
      const box = document.createElement("div");
      box.className = "resume-print-page";
      box.appendChild(paper.cloneNode(true));
      host.appendChild(box);
    }

    // 打印前确保 Noto Sans SC 的相关切片已加载，否则打印可能落到未嵌入的系统字体、丢字。
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    // 用 auwe-nb-<时间戳> 作打印任务标题：Chromium 以此为「另存为 PDF」的默认文件名与 PDF 的
    // Title 元数据，从而在导出物里留下 auwe 痕迹。打印结束后还原页面标题。
    const prevTitle = document.title;
    document.title = exportBaseName();

    const cleanup = () => {
      host.innerHTML = "";
      document.title = prevTitle;
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }, []);

  // ⌘P / Ctrl+P 拦截：不拦截的话裸 ⌘P 打印的是三栏工作台而非简历纸。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        print();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [print]);

  return { print };
}
