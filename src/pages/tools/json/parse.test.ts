import { describe, expect, it } from "vitest";
import { parseJsonLenient } from "./parse";

// 用户给的典型「脏 JSON」：缺引号的值/键、注释、字符串拼接、多余转义、缺逗号。
const DIRTY = String.raw`{
    "duckConfig": {
        "name": "Quack Overflow",
        "hasGlasses": true,
        "floats": null
    },
    "pondStats": {
        "temperature": 22.5,
        "isFrozen": false,
        "coordinates": [
            59.9139,
            10.7522
        ]
    },
    "dailyActivities": [
        Swim
        "Debug fountain" // Ducks do that sometimes 🦆
        "Line" + " " + \"up\"
    ],
    features: {}
}`;

describe("parseJsonLenient", () => {
  it("合法 JSON 走严格解析，repaired=false", () => {
    const res = parseJsonLenient('{"a": 1}');
    expect(res).toEqual({ ok: true, value: { a: 1 }, repaired: false });
  });

  it("脏 JSON 修复后可解析，repaired=true", () => {
    const res = parseJsonLenient(DIRTY);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.repaired).toBe(true);
    const v = res.value as Record<string, unknown>;
    expect(Object.keys(v)).toEqual([
      "duckConfig",
      "pondStats",
      "dailyActivities",
      "features",
    ]);
    // 缺引号的值、行注释剥离、字符串拼接、转义引号全部修复
    expect(v.dailyActivities).toEqual(["Swim", "Debug fountain", "Line up"]);
    // 缺引号的键
    expect(v.features).toEqual({});
    // 正常部分原样保留
    expect((v.pondStats as Record<string, unknown>).coordinates).toEqual([
      59.9139, 10.7522,
    ]);
  });

  it("救不回来的文本报严格解析错误", () => {
    const res = parseJsonLenient("");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.length).toBeGreaterThan(0);
  });
});
