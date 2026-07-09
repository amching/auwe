import { useCallback, useEffect } from "react";

/**
 * 简历 PDF 导出：浏览器原生打印（不用 html2canvas / jsPDF，保证文字可选中可搜索）。
 *
 * 把 .resume-paper 克隆进 body 直下的 #print-root，@media print（resume.css 内）
 * 隐藏 #root、只显示 #print-root，再 window.print()。挂在 body 直下 + 打印时整个隐藏
 * #root，使打印内容不受工作台祖先 overflow/transform 影响。
 *
 * 两条入口——导出按钮与 ⌘P/Ctrl+P 拦截——走同一个 print()。
 */
export function usePrintResume() {
  const print = useCallback(async () => {
    const paper = document.querySelector<HTMLElement>(".resume-paper");
    if (!paper) return;

    let host = document.getElementById("print-root");
    if (!host) {
      host = document.createElement("div");
      host.id = "print-root";
      document.body.appendChild(host);
    }
    // 克隆屏幕预览的实际渲染节点，保证打印与预览逐字一致。
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
