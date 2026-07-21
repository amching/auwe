import { describe, expect, it } from "vitest";
import type { PolishLevel, QuarterlyReportInput } from "./prompts";
import {
  isQuarterlyReportStale,
  type QuarterlySnapshot,
} from "./useQuarterlyReport";

const input = (
  over: Partial<QuarterlyReportInput> = {},
): QuarterlyReportInput => ({
  quarterLabel: "2026 年第三季度",
  quarterRange: "7 月 1 日 – 9 月 30 日",
  goals: "完成第一版",
  achievements: [{ action: "做了 A", impact: "价值 A", evidence: "" }],
  unfinished: "",
  nextQuarterPriorities: "上线",
  risks: "",
  ...over,
});

const snap = (
  over: Partial<QuarterlyReportInput> = {},
  level: PolishLevel = 3,
): QuarterlySnapshot => ({ input: input(over), level });

describe("isQuarterlyReportStale", () => {
  it("无快照不算过期", () => {
    expect(isQuarterlyReportStale(null, input(), 3)).toBe(false);
  });

  it("内容与等级都未变时不算过期", () => {
    expect(isQuarterlyReportStale(snap(), input(), 3)).toBe(false);
  });

  it("修改目标 / 下季度重点 / 复盘 / 风险 → 过期", () => {
    expect(isQuarterlyReportStale(snap(), input({ goals: "变" }), 3)).toBe(
      true,
    );
    expect(
      isQuarterlyReportStale(snap(), input({ nextQuarterPriorities: "变" }), 3),
    ).toBe(true);
    expect(isQuarterlyReportStale(snap(), input({ unfinished: "变" }), 3)).toBe(
      true,
    );
    expect(isQuarterlyReportStale(snap(), input({ risks: "变" }), 3)).toBe(
      true,
    );
  });

  it("修改成果数组 → 过期", () => {
    expect(
      isQuarterlyReportStale(
        snap(),
        input({
          achievements: [{ action: "做了 B", impact: "", evidence: "" }],
        }),
        3,
      ),
    ).toBe(true);
  });

  it("修改润色等级 → 过期", () => {
    expect(isQuarterlyReportStale(snap(), input(), 5)).toBe(true);
  });

  it("仅切换季度 → 不算过期", () => {
    expect(
      isQuarterlyReportStale(
        snap(),
        input({
          quarterLabel: "2026 年第四季度",
          quarterRange: "10 月 1 日 – 12 月 31 日",
        }),
        3,
      ),
    ).toBe(false);
  });
});
