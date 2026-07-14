import { describe, expect, it } from "vitest";
import { type DiffSegment, diffText, tokenize } from "./diff";

/** 校验 diff 的两条守恒律：same+del 拼回原文，same+add 拼出新文。 */
function assertReconstructs(segs: DiffSegment[], a: string, b: string) {
  const oldText = segs
    .filter((s) => s.type !== "add")
    .map((s) => s.text)
    .join("");
  const newText = segs
    .filter((s) => s.type !== "del")
    .map((s) => s.text)
    .join("");
  expect(oldText).toBe(a);
  expect(newText).toBe(b);
}

describe("tokenize", () => {
  it("英文词与数字保持整体，中文逐字，空白成段", () => {
    expect(tokenize("负责 Kafka 集群")).toEqual([
      "负",
      "责",
      " ",
      "Kafka",
      " ",
      "集",
      "群",
    ]);
    expect(tokenize("P99 延迟 820ms")).toEqual([
      "P99",
      " ",
      "延",
      "迟",
      " ",
      "820ms",
    ]);
  });

  it("空串返回空数组", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("diffText", () => {
  it("相同文本返回单个 same 段", () => {
    expect(diffText("abc", "abc")).toEqual([{ type: "same", text: "abc" }]);
    expect(diffText("", "")).toEqual([]);
  });

  it("纯新增 / 纯删除", () => {
    expect(diffText("", "新增")).toEqual([{ type: "add", text: "新增" }]);
    expect(diffText("删掉", "")).toEqual([{ type: "del", text: "删掉" }]);
  });

  it("中间替换：保留公共前后缀", () => {
    const segs = diffText("负责系统的日常维护", "负责系统的架构演进");
    assertReconstructs(segs, "负责系统的日常维护", "负责系统的架构演进");
    expect(segs[0]).toEqual({ type: "same", text: "负责系统的" });
  });

  it("中英混排按词对齐", () => {
    const a = "使用 MySQL 存储数据";
    const b = "使用 PostgreSQL 存储数据";
    const segs = diffText(a, b);
    assertReconstructs(segs, a, b);
    expect(segs).toContainEqual({ type: "del", text: "MySQL" });
    expect(segs).toContainEqual({ type: "add", text: "PostgreSQL" });
  });

  it("多行 Markdown 片段可对齐重建", () => {
    const a = "- 主导重构，延迟从 820ms 降到 110ms\n- 建设统一网关";
    const b =
      "- 主导交易核心重构，P99 延迟从 820ms 降至 110ms\n- 建设统一网关平台";
    assertReconstructs(diffText(a, b), a, b);
  });

  it("相邻同类段已合并", () => {
    const segs = diffText("甲乙丙", "丁戊己");
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].type).not.toBe(segs[i - 1].type);
    }
    assertReconstructs(segs, "甲乙丙", "丁戊己");
  });

  it("超大输入退化为整段替换但仍守恒", () => {
    const a = "一二三四五六七八九十".repeat(200);
    const b = "十九八七六五四三二一".repeat(200);
    assertReconstructs(diffText(a, b), a, b);
  });
});
