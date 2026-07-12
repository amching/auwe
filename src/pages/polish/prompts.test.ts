import { describe, expect, it } from "vitest";
import {
  buildDailyReportPrompt,
  DAILY_REPORT_STYLE_INSTRUCTIONS,
  isPolishLevel,
  type PolishLevel,
} from "./prompts";

const ALL_LEVELS: PolishLevel[] = [1, 2, 3, 4, 5];
const SAMPLE = "今天修复了登录页面的问题，和后端确认了接口，还没上线";

describe("buildDailyReportPrompt", () => {
  it("五个等级生成不同的风格指令", () => {
    const styles = ALL_LEVELS.map((l) => DAILY_REPORT_STYLE_INSTRUCTIONS[l]);
    expect(new Set(styles).size).toBe(5);

    // 组装后的完整 prompt 也应互不相同
    const prompts = ALL_LEVELS.map((l) => buildDailyReportPrompt(SAMPLE, l));
    expect(new Set(prompts).size).toBe(5);
  });

  it("所有等级都包含禁止虚构事实的规则", () => {
    for (const level of ALL_LEVELS) {
      const prompt = buildDailyReportPrompt(SAMPLE, level);
      expect(prompt).toContain("不得虚构");
      expect(prompt).toContain("不得编造数字");
      expect(prompt).toContain("正在进行");
      expect(prompt).toContain("已经完成");
    }
  });

  it("用户原始内容被完整放入 Prompt 且带边界标签", () => {
    const prompt = buildDailyReportPrompt(SAMPLE, 3);
    expect(prompt).toContain(SAMPLE);
    expect(prompt).toContain("<user_daily_content>");
    expect(prompt).toContain("</user_daily_content>");
  });

  it("空输入（含纯空白）抛错，不会进入 LLM 调用", () => {
    expect(() => buildDailyReportPrompt("", 1)).toThrow();
    expect(() => buildDailyReportPrompt("   \n  ", 1)).toThrow();
  });

  it("非法等级被运行时校验拦截", () => {
    expect(() => buildDailyReportPrompt(SAMPLE, 0 as PolishLevel)).toThrow();
    expect(() => buildDailyReportPrompt(SAMPLE, 6 as PolishLevel)).toThrow();
  });
});

describe("isPolishLevel", () => {
  it("只接受 1–5", () => {
    expect(ALL_LEVELS.every(isPolishLevel)).toBe(true);
    expect(isPolishLevel(0)).toBe(false);
    expect(isPolishLevel(6)).toBe(false);
    expect(isPolishLevel("3")).toBe(false);
    expect(isPolishLevel(undefined)).toBe(false);
  });
});
