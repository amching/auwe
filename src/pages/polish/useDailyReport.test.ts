import { describe, expect, it } from "vitest";
import type { PolishLevel } from "./prompts";
import { type GenerationSnapshot, isReportStale } from "./useDailyReport";

const snap = (input: string, level: PolishLevel): GenerationSnapshot => ({
  input,
  level,
});

describe("isReportStale", () => {
  it("尚未生成过（无快照）时不算过期", () => {
    expect(isReportStale(null, "今天写了代码", 2)).toBe(false);
  });

  it("输入与等级都未变时不算过期", () => {
    expect(isReportStale(snap("今天写了代码", 2), "今天写了代码", 2)).toBe(
      false,
    );
  });

  it("修改了原始输入 → 过期", () => {
    expect(isReportStale(snap("今天写了代码", 2), "今天写了文档", 2)).toBe(
      true,
    );
  });

  it("修改了润色等级 → 过期", () => {
    expect(isReportStale(snap("今天写了代码", 2), "今天写了代码", 5)).toBe(
      true,
    );
  });
});
