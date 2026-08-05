import { describe, expect, it } from "vitest";
import { cleanEnglish, countChars, isResultStale } from "./text";

describe("countChars", () => {
  it("按字数数中文，不数 UTF-16 码元", () => {
    expect(countChars("中午想吃点什么")).toBe(7);
    expect(countChars("你好🙂")).toBe(3);
  });

  it("忽略空白与换行", () => {
    expect(countChars("  中午 想吃\n点什么  ")).toBe(7);
    expect(countChars("   ")).toBe(0);
    expect(countChars("")).toBe(0);
  });

  it("英文按字符数（混排也能给出稳定数字）", () => {
    expect(countChars("ok 好")).toBe(3);
  });
});

describe("cleanEnglish", () => {
  it("剥掉整段包裹的引号", () => {
    expect(cleanEnglish('"What should we grab for lunch?"')).toBe(
      "What should we grab for lunch?",
    );
    expect(cleanEnglish("“Let's eat.”")).toBe("Let's eat.");
  });

  it("保留正文内部的引号与撇号", () => {
    expect(cleanEnglish(`He said "hi" and left.`)).toBe(
      `He said "hi" and left.`,
    );
    expect(cleanEnglish("It's fine.")).toBe("It's fine.");
  });

  it("剥掉整段包裹的 Markdown 强调", () => {
    expect(cleanEnglish("**What's for lunch?**")).toBe("What's for lunch?");
    expect(cleanEnglish("*Let's go.*")).toBe("Let's go.");
  });

  it("不动正文内部的强调标记", () => {
    expect(cleanEnglish("I **really** mean it.")).toBe("I **really** mean it.");
  });

  it("去掉首尾空白", () => {
    expect(cleanEnglish("\n  Let's go.  \n")).toBe("Let's go.");
  });
});

describe("isResultStale", () => {
  it("还没生成过 → 不过期", () => {
    expect(isResultStale(null, "中午吃什么")).toBe(false);
  });

  it("中文改了 → 过期", () => {
    expect(isResultStale("中午吃什么", "晚上吃什么")).toBe(true);
  });

  it("只差首尾空白 → 不算改动", () => {
    expect(isResultStale("中午吃什么", "  中午吃什么\n")).toBe(false);
  });
});
