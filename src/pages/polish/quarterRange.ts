// 自然季度计算（纯函数，无副作用，便于单测）。
// Q1=1–3 月，Q2=4–6 月，Q3=7–9 月，Q4=10–12 月。

/** 一个自然季度：年份 + 季度序号（1–4）。 */
export interface QuarterRange {
  year: number;
  quarter: 1 | 2 | 3 | 4;
}

const QUARTER_CN = ["一", "二", "三", "四"] as const;

/** 计算给定日期所在的自然季度。 */
export function quarterOf(date: Date): QuarterRange {
  const quarter = (Math.floor(date.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  return { year: date.getFullYear(), quarter };
}

/** 前移 / 后移若干季度（delta 可正可负，跨年自动进位）。 */
export function shiftQuarter(
  range: QuarterRange,
  deltaQuarters: number,
): QuarterRange {
  // 化为「绝对季度序号」再还原，天然处理跨年。
  const index = range.year * 4 + (range.quarter - 1) + deltaQuarters;
  const year = Math.floor(index / 4);
  const quarter = ((index % 4) + 1) as 1 | 2 | 3 | 4;
  return { year, quarter };
}

/** 中文季度名，如「2026 年第三季度」。 */
export function formatQuarterLabel(range: QuarterRange): string {
  return `${range.year} 年第${QUARTER_CN[range.quarter - 1]}季度`;
}

/** 季度日期范围，如「7 月 1 日 – 9 月 30 日」。 */
export function formatQuarterDateRange(range: QuarterRange): string {
  const startMonth = (range.quarter - 1) * 3 + 1;
  const endMonth = range.quarter * 3;
  // new Date(y, endMonth, 0) = endMonth 月的最后一天（day 0 回退到上月末）。
  const endDay = new Date(range.year, endMonth, 0).getDate();
  return `${startMonth} 月 1 日 – ${endMonth} 月 ${endDay} 日`;
}
