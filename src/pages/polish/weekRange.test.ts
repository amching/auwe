import { describe, expect, it } from "vitest";
import { formatWeekLabel, shiftWeek, weekOf } from "./weekRange";

describe("weekOf", () => {
  it("周一到周日属于同一周（周一为起点）", () => {
    // 2026-07-20 是周一，2026-07-26 是周日。
    const expected = { start: "2026-07-20", end: "2026-07-26" };
    for (const day of [20, 21, 22, 23, 24, 25, 26]) {
      expect(weekOf(new Date(2026, 6, day))).toEqual(expected);
    }
  });

  it("周日归属上一周而非下一周", () => {
    // 2026-07-19 是周日，应落在 07-13 ~ 07-19 这一周。
    expect(weekOf(new Date(2026, 6, 19))).toEqual({
      start: "2026-07-13",
      end: "2026-07-19",
    });
  });

  it("忽略时分秒，只按日期归周", () => {
    expect(weekOf(new Date(2026, 6, 22, 23, 59, 59))).toEqual({
      start: "2026-07-20",
      end: "2026-07-26",
    });
  });

  it("跨月的周也能正确计算", () => {
    // 2026-08-01 是周六 → 本周为 07-27 ~ 08-02。
    expect(weekOf(new Date(2026, 7, 1))).toEqual({
      start: "2026-07-27",
      end: "2026-08-02",
    });
  });
});

describe("shiftWeek", () => {
  const base = { start: "2026-07-20", end: "2026-07-26" };

  it("上一周 / 下一周", () => {
    expect(shiftWeek(base, -1)).toEqual({
      start: "2026-07-13",
      end: "2026-07-19",
    });
    expect(shiftWeek(base, 1)).toEqual({
      start: "2026-07-27",
      end: "2026-08-02",
    });
  });

  it("delta 为 0 时返回同一周", () => {
    expect(shiftWeek(base, 0)).toEqual(base);
  });

  it("连续前移多周仍落在周一~周日", () => {
    const r = shiftWeek(base, -5);
    expect(r).toEqual({ start: "2026-06-15", end: "2026-06-21" });
  });
});

describe("formatWeekLabel", () => {
  it("格式为「M 月 D 日 – M 月 D 日」", () => {
    expect(formatWeekLabel({ start: "2026-07-20", end: "2026-07-26" })).toBe(
      "7 月 20 日 – 7 月 26 日",
    );
  });

  it("跨月正常显示两侧月份", () => {
    expect(formatWeekLabel({ start: "2026-07-27", end: "2026-08-02" })).toBe(
      "7 月 27 日 – 8 月 2 日",
    );
  });
});
