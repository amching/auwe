// 自然周计算（纯函数，无副作用，便于单测）。
// 约定：一周从「周一」开始、到「周日」结束（符合国内周报习惯）。
// 内部用本地时区的 YYYY-MM-DD 字符串表示日期，避免 UTC 偏移导致跨天误差。

/** 一个自然周的起止（本地日期，格式 YYYY-MM-DD，含首尾两端）。 */
export interface WeekRange {
  /** 周一 */
  start: string;
  /** 周日 */
  end: string;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Date → 本地 YYYY-MM-DD（丢弃时分秒，只保留日期）。 */
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 本地 YYYY-MM-DD → 当天 00:00 的本地 Date。 */
function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 计算给定日期所在的自然周（周一 ~ 周日）。 */
export function weekOf(date: Date): WeekRange {
  // 归一化到当天 00:00，避免时分秒参与运算。
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0=周日 … 6=周六；换算成「距本周一的天数」。
  const daysSinceMonday = (d.getDay() + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - daysSinceMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toISODate(start), end: toISODate(end) };
}

/** 把某个自然周整体前移 / 后移若干周（delta 可正可负）。 */
export function shiftWeek(range: WeekRange, deltaWeeks: number): WeekRange {
  const start = fromISODate(range.start);
  start.setDate(start.getDate() + deltaWeeks * 7);
  return weekOf(start);
}

/**
 * 格式化为中文周范围标签，例如「7 月 20 日 – 7 月 26 日」。
 * 跨年 / 跨月都只显示「月 日」（第一版不显示年份，够用即可）。
 */
export function formatWeekLabel(range: WeekRange): string {
  const s = fromISODate(range.start);
  const e = fromISODate(range.end);
  const fmt = (d: Date) => `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  return `${fmt(s)} – ${fmt(e)}`;
}
