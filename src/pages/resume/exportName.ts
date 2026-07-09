/**
 * 导出物的统一命名：auwe-nb-<YYYYMMDDHHmm>（本地时区，零填充）。
 * 例：2026-07-08 22:07 → auwe-nb-202607082207。
 * 同时作为 Markdown 文件名、PDF 保存文件名与 PDF 标题元数据，留下 auwe 工具痕迹。
 */
export function exportBaseName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const ts =
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `${p(date.getHours())}${p(date.getMinutes())}`;
  return `auwe-nb-${ts}`;
}
