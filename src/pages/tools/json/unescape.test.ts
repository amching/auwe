import { describe, expect, it } from "vitest";
import { decodeEscapesOnce, unescapeJson } from "./unescape";

describe("decodeEscapesOnce", () => {
  it("解码常见转义", () => {
    expect(decodeEscapesOnce(String.raw`a\"b`)).toBe('a"b');
    expect(decodeEscapesOnce(String.raw`a\\b`)).toBe(String.raw`a\b`);
    expect(decodeEscapesOnce(String.raw`a\nb\tc`)).toBe("a\nb\tc");
    expect(decodeEscapesOnce("中文")).toBe("中文");
    expect(decodeEscapesOnce(String.raw`a\/b`)).toBe("a/b");
  });

  it("非法转义原样保留，不瞎猜", () => {
    expect(decodeEscapesOnce(String.raw`a\xb`)).toBe(String.raw`a\xb`);
    expect(decodeEscapesOnce(String.raw`a\u12`)).toBe(String.raw`a\u12`);
    expect(decodeEscapesOnce("trailing\\")).toBe("trailing\\");
  });
});

describe("unescapeJson", () => {
  it("本来就是合法 JSON：原样返回，layers=0，内部转义不动", () => {
    const res = unescapeJson(String.raw`{"msg":"a\nb","q":"say \"hi\""}`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.layers).toBe(0);
    expect(res.value).toEqual({ msg: "a\nb", q: 'say "hi"' });
  });

  it("整份文档被转义一层：剥掉后解析", () => {
    const res = unescapeJson(String.raw`{\"a\":1,\"b\":\"x\"}`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ a: 1, b: "x" });
    expect(res.layers).toBe(1);
  });

  it("JSON 被当成字符串：剥掉外层字符串壳", () => {
    const res = unescapeJson(String.raw`"{\"a\":1}"`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ a: 1 });
    expect(res.layers).toBe(1);
  });

  it("多层转义：逐层剥到底", () => {
    const res = unescapeJson(String.raw`{\\\"a\\\":1}`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ a: 1 });
    expect(res.layers).toBeGreaterThanOrEqual(2);
  });

  it("二次转义的字符串壳", () => {
    const res = unescapeJson(String.raw`"{\\\"a\\\":1}"`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ a: 1 });
  });

  it("转义 + 非标准 JSON：容错解析兜底", () => {
    const res = unescapeJson(String.raw`{\"a\":1, b: Swim}`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ a: 1, b: "Swim" });
  });

  it("本来就是 JSON 字符串：原样保留，不去拆壳", () => {
    const res = unescapeJson('"hello"');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toBe("hello");
    expect(res.layers).toBe(0);
  });

  it("转义后的内容不是 JSON：报错而不是瞎输出", () => {
    const res = unescapeJson(String.raw`hello\nworld`);
    expect(res.ok).toBe(false);
  });

  it("空输入报错", () => {
    const res = unescapeJson("   ");
    expect(res.ok).toBe(false);
  });
});
