import { describe, expect, it } from "vitest";
import type { PolishLevel, WeeklyReportInput } from "./prompts";
import { isWeeklyReportStale, type WeeklySnapshot } from "./useWeeklyReport";

const input = (over: Partial<WeeklyReportInput> = {}): WeeklyReportInput => ({
  weekLabel: "7 月 20 日 – 7 月 26 日",
  progress: "完成登录页修复",
  unfinished: "",
  nextWeekPlan: "",
  risks: "",
  ...over,
});

const snap = (
  over: Partial<WeeklyReportInput> = {},
  level: PolishLevel = 3,
): WeeklySnapshot => ({ input: input(over), level });

describe("isWeeklyReportStale", () => {
  it("尚未生成过（无快照）时不算过期", () => {
    expect(isWeeklyReportStale(null, input(), 3)).toBe(false);
  });

  it("内容与等级都未变时不算过期", () => {
    expect(isWeeklyReportStale(snap(), input(), 3)).toBe(false);
  });

  it("修改任一内容分区 → 过期", () => {
    expect(isWeeklyReportStale(snap(), input({ progress: "别的" }), 3)).toBe(
      true,
    );
    expect(isWeeklyReportStale(snap(), input({ unfinished: "新增" }), 3)).toBe(
      true,
    );
    expect(
      isWeeklyReportStale(snap(), input({ nextWeekPlan: "新增" }), 3),
    ).toBe(true);
    expect(isWeeklyReportStale(snap(), input({ risks: "新增" }), 3)).toBe(true);
  });

  it("修改润色等级 → 过期", () => {
    expect(isWeeklyReportStale(snap(), input(), 5)).toBe(true);
  });

  it("仅切换本周时间范围 → 不算过期", () => {
    expect(
      isWeeklyReportStale(
        snap(),
        input({ weekLabel: "7 月 27 日 – 8 月 2 日" }),
        3,
      ),
    ).toBe(false);
  });
});
