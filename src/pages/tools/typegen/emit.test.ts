import { describe, expect, it } from "vitest";
import { DEFAULT_EMIT_OPTIONS, emitGo, emitRust, emitTypeScript } from "./emit";
import { inferTypes } from "./infer";

const SAMPLE = {
  duckConfig: { name: "Quack Overflow", hasGlasses: true, floats: null },
  pondStats: { temperature: 22.5, isFrozen: false, coordinates: [59.9, 10.7] },
  dailyActivities: ["Swim", "Line up"],
  features: {},
};

describe("emitTypeScript", () => {
  it("对象根输出 interface，null-only 字段是 any", () => {
    const out = emitTypeScript(inferTypes(SAMPLE));
    expect(out).toContain("export interface Root {");
    expect(out).toContain("duckConfig: DuckConfig;");
    expect(out).toContain("floats: any;");
    expect(out).toContain("coordinates: number[];");
    expect(out).toContain("dailyActivities: string[];");
    expect(out).toContain("export interface Features {}");
  });

  it("optional → ?、nullable → | null、非法键加引号", () => {
    const out = emitTypeScript(
      inferTypes({ rows: [{ "a-b": 1, opt: "x" }, { "a-b": null }] }),
    );
    expect(out).toContain('"a-b": number | null;');
    expect(out).toContain("opt?: string;");
  });

  it("数组根输出类型别名", () => {
    const out = emitTypeScript(inferTypes([{ a: 1 }]));
    expect(out).toContain("export type Root = RootItem[];");
    expect(out).toContain("export interface RootItem {");
  });
});

describe("emitGo", () => {
  it("omitempty=optional：只打推断为可选/可空的字段，缩写字段名大写", () => {
    const out = emitGo(
      inferTypes({
        rows: [{ user_id: 1, url: "x", note: "n" }, { user_id: 2 }],
      }),
      { jsonTags: true, omitempty: "optional", pointers: true },
    );
    expect(out).toMatch(/UserID int\s+`json:"user_id"`/);
    expect(out).toMatch(/URL\s+\*string\s+`json:"url,omitempty"`/);
    expect(out).toMatch(/Note\s+\*string\s+`json:"note,omitempty"`/);
  });

  it("omitempty=all（默认）：必填字段也打", () => {
    const out = emitGo(
      inferTypes({ rows: [{ user_id: 1 }] }),
      DEFAULT_EMIT_OPTIONS.go,
    );
    expect(out).toMatch(/Rows \[\]Row `json:"rows,omitempty"`/);
    expect(out).toMatch(/UserID int `json:"user_id,omitempty"`/);
  });

  it("关掉 tags / omitempty / 指针", () => {
    const out = emitGo(inferTypes({ rows: [{ a: 1 }, {}] }), {
      jsonTags: false,
      omitempty: "none",
      pointers: false,
    });
    expect(out).toContain("A int");
    expect(out).not.toContain("json:");
    expect(out).not.toContain("*int");
  });

  it("数组根输出别名，any 不包指针", () => {
    const out = emitGo(inferTypes([{ x: null }]), {
      jsonTags: true,
      omitempty: "none",
      pointers: true,
    });
    expect(out).toContain("type Root = []RootItem");
    expect(out).toMatch(/X any\s+`json:"x"`/);
  });
});

describe("emitRust", () => {
  it("serde：rename 驼峰键、Option 表可空、关键字用 raw ident", () => {
    const out = emitRust(
      inferTypes({ hasGlasses: true, type: "duck", floats: null, n: [1, 2] }),
      { serde: true },
    );
    expect(out).toContain("use serde::{Deserialize, Serialize};");
    expect(out).toContain('#[serde(rename = "hasGlasses")]');
    expect(out).toContain("pub has_glasses: bool,");
    expect(out).toContain("pub r#type: String,");
    expect(out).toContain("pub floats: serde_json::Value,");
    expect(out).toContain("pub n: Vec<i64>,");
  });

  it("optional 字段带 skip_serializing_if，关 serde 后无属性", () => {
    const on = emitRust(inferTypes({ rows: [{ a: 1 }, {}] }), { serde: true });
    expect(on).toContain('#[serde(skip_serializing_if = "Option::is_none")]');
    expect(on).toContain("pub a: Option<i64>,");
    const off = emitRust(inferTypes({ rows: [{ a: 1 }, {}] }), {
      serde: false,
    });
    expect(off).not.toContain("serde");
    expect(off).toContain("#[derive(Debug, Clone)]");
  });
});
