import { describe, expect, it } from "vitest";
import { coerceCell, csvRows, parseCsv, parseInput } from "./parseInput";

describe("csvRows", () => {
  it("引号字段：内含逗号、换行、转义引号", () => {
    const rows = csvRows('a,b\n"x,1","he said ""hi""\nnext"\r\nplain,2\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x,1", 'he said "hi"\nnext'],
      ["plain", "2"],
    ]);
  });
});

describe("coerceCell", () => {
  it("标量推断", () => {
    expect(coerceCell("")).toBeNull();
    expect(coerceCell("true")).toBe(true);
    expect(coerceCell("42")).toBe(42);
    expect(coerceCell("-3.5e2")).toBe(-350);
    expect(coerceCell("007")).toBe(7);
    expect(coerceCell("hello")).toBe("hello");
    // 超出安全整数保留字符串（订单号/ID 场景）
    expect(coerceCell("9007199254740993")).toBe("9007199254740993");
  });
});

describe("parseCsv", () => {
  it("首行表头 → 对象数组，空单元格 → null，短行缺列 → 缺席", () => {
    expect(parseCsv("name,age,vip\nann,30,true\nbob,")).toEqual([
      { name: "ann", age: 30, vip: true },
      { name: "bob", age: null },
    ]);
  });

  it("只有表头时报错", () => {
    expect(() => parseCsv("a,b\n")).toThrow();
  });
});

describe("parseInput", () => {
  it("yaml / toml / 空输入", () => {
    expect(parseInput("a: 1\nb: [x]", "yaml")).toMatchObject({
      ok: true,
      value: { a: 1, b: ["x"] },
    });
    expect(
      parseInput('title = "t"\n[owner]\nname = "n"', "toml"),
    ).toMatchObject({ ok: true, value: { title: "t", owner: { name: "n" } } });
    expect(parseInput("  ", "json")).toMatchObject({ ok: false });
    expect(parseInput("a: [", "yaml").ok).toBe(false);
  });
});
