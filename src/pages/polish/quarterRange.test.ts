import { describe, expect, it } from "vitest";
import {
  formatQuarterDateRange,
  formatQuarterLabel,
  quarterOf,
  shiftQuarter,
} from "./quarterRange";

describe("quarterOf", () => {
  it("按月份归入正确季度", () => {
    expect(quarterOf(new Date(2026, 0, 15))).toEqual({
      year: 2026,
      quarter: 1,
    });
    expect(quarterOf(new Date(2026, 3, 1))).toEqual({ year: 2026, quarter: 2 });
    expect(quarterOf(new Date(2026, 6, 21))).toEqual({
      year: 2026,
      quarter: 3,
    });
    expect(quarterOf(new Date(2026, 11, 31))).toEqual({
      year: 2026,
      quarter: 4,
    });
  });
});

describe("shiftQuarter", () => {
  const q3 = { year: 2026, quarter: 3 } as const;

  it("上一季度 / 下一季度", () => {
    expect(shiftQuarter(q3, -1)).toEqual({ year: 2026, quarter: 2 });
    expect(shiftQuarter(q3, 1)).toEqual({ year: 2026, quarter: 4 });
  });

  it("跨年进位", () => {
    expect(shiftQuarter(q3, 2)).toEqual({ year: 2027, quarter: 1 });
    expect(shiftQuarter({ year: 2026, quarter: 1 }, -1)).toEqual({
      year: 2025,
      quarter: 4,
    });
  });

  it("delta 为 0 返回同一季度", () => {
    expect(shiftQuarter(q3, 0)).toEqual(q3);
  });
});

describe("formatQuarterLabel", () => {
  it("中文季度名", () => {
    expect(formatQuarterLabel({ year: 2026, quarter: 3 })).toBe(
      "2026 年第三季度",
    );
    expect(formatQuarterLabel({ year: 2025, quarter: 1 })).toBe(
      "2025 年第一季度",
    );
  });
});

describe("formatQuarterDateRange", () => {
  it("各季度日期范围（含月末天数）", () => {
    expect(formatQuarterDateRange({ year: 2026, quarter: 1 })).toBe(
      "1 月 1 日 – 3 月 31 日",
    );
    expect(formatQuarterDateRange({ year: 2026, quarter: 2 })).toBe(
      "4 月 1 日 – 6 月 30 日",
    );
    expect(formatQuarterDateRange({ year: 2026, quarter: 3 })).toBe(
      "7 月 1 日 – 9 月 30 日",
    );
    expect(formatQuarterDateRange({ year: 2026, quarter: 4 })).toBe(
      "10 月 1 日 – 12 月 31 日",
    );
  });
});
