import { useCallback, useEffect } from "react";

/**
 * 简历 PDF 导出：浏览器原生打印（不用 html2canvas / jsPDF，保证文字可选中可搜索）。
 *
 * 克隆的是隐藏的「连续源」#resume-print-source（而非可见的分页页框）——让浏览器按 @page
 * 原生分页。源与预览分页共用同一份 CSS / 内容宽（178mm）/ 字号间距系数，故基本一致：它带的
 * inline --resume-spacing / --resume-type 随 outerHTML 一起进 #print-root，打印字号间距与预览一致。
 *
 * 把它克隆进 body 直下的 #print-root，@media print（resume.css 内）隐藏 body 下除 #print-root
 * 外的一切（含下拉/弹层 portal），再 window.print()。挂在 body 直下 + 打印时隐藏其余节点，使打印
 * 内容不受工作台祖先 overflow/transform 影响，也不被残留 portal 撑宽而触发打印缩放。
 *
 * 两条入口——导出按钮与 ⌘P/Ctrl+P 拦截——走同一个 print()。
 */
export function usePrintResume() {
  const print = useCallback(async () => {
    const paper = document.getElementById("resume-print-source");
    if (!paper) return;

    let host = document.getElementById("print-root");
    if (!host) {
      host = document.createElement("div");
      host.id = "print-root";
      document.body.appendChild(host);
    }
    // 克隆隐藏连续源的渲染节点，保证打印与预览逐字一致。
    host.innerHTML = paper.outerHTML;

    // 打印前确保 Noto Sans SC 的相关切片已加载，否则打印可能落到未嵌入的系统字体、丢字。
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const cleanup = () => {
      host.innerHTML = "";
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
