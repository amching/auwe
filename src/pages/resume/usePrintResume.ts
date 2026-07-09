import { useCallback, useEffect } from "react";

/**
 * 铁律 1：浏览器原生打印，禁止 html2canvas / jsPDF。
 *
 * 打印主文档（portal 方式），不走子 iframe：Chromium 从子 iframe
 * `contentWindow.print()` 打印时，CJK 逐字回退字体不会被正确解析/嵌入，导致中文
 * 全部丢失（拉丁/数字正常）——与 iframe 尺寸无关。主文档打印是顶层路径，字体回退正常。
 *
 * 做法：把简历 .resume-paper 克隆进 body 下的 #print-root，@media print（在
 * resume.css 里）隐藏 #root、只显示 #print-root，再 window.print()。简历挂在 body 直下、
 * 打印时整个隐藏 #root，绕开工作台祖先 overflow/transform 的裁剪。
 *
 * 两条入口（导出按钮 / ⌘P 拦截）走同一个 print()。
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
