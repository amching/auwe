/** 「用英语学说话」的纯文本逻辑：字数统计、结果清洗、过期判断（都有单测）。 */

/** 建议字数上限（只用于提示，不做任何禁用）。 */
export const SUGGESTED_MAX = 200;
/** 建议字数下限（同样只提示，少于它也允许生成）。 */
export const SUGGESTED_MIN = 20;

/**
 * 中文字数：按「字」数，不按 UTF-16 码元——emoji / 生僻字算一个字。
 * 空白（含换行）不计入，否则排版换行会虚高字数。
 */
export function countChars(text: string): number {
  let n = 0;
  for (const ch of text) {
    if (!/\s/.test(ch)) n += 1;
  }
  return n;
}

const QUOTE_PAIRS: [string, string][] = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
];

/**
 * 内容层兜底：提示词已明确「不要引号、不要 Markdown」，但模型偶尔还是会把整段
 * 结果包在引号里或加粗。这里确定性地剥掉最外层包装，保证用户看到的是干净正文。
 * 只处理整段包裹的情况——正文内部的引号（It's、he said "hi"）一律保留。
 */
export function cleanEnglish(raw: string): string {
  let text = raw.trim();
  // 整段被 ** 或 * 包住（且内部没有再出现同样的标记）→ 视为多余的 Markdown 强调。
  for (const mark of ["**", "*"]) {
    if (
      text.length > mark.length * 2 &&
      text.startsWith(mark) &&
      text.endsWith(mark) &&
      !text.slice(mark.length, -mark.length).includes(mark)
    ) {
      text = text.slice(mark.length, -mark.length).trim();
    }
  }
  for (const [open, close] of QUOTE_PAIRS) {
    if (
      text.length > 1 &&
      text.startsWith(open) &&
      text.endsWith(close) &&
      !text.slice(1, -1).includes(close)
    ) {
      text = text.slice(1, -1).trim();
    }
  }
  return text;
}

/**
 * 结果是否已过期：已生成过一次，且当前中文与生成时所用的中文不一致。
 * 过期只是「提示重新生成」，旧结果仍然保留展示（弱化），避免用户误以为对应新中文。
 */
export function isResultStale(
  generatedFrom: string | null,
  current: string,
): boolean {
  if (generatedFrom === null) return false;
  return generatedFrom.trim() !== current.trim();
}
