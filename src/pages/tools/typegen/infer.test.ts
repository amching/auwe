import { describe, expect, it } from "vitest";
import { inferTypes } from "./infer";

describe("inferTypes", () => {
  it("对象根：Root 在最前，嵌套对象按键名起类型名", () => {
    const inf = inferTypes({
      duckConfig: { name: "Quack", hasGlasses: true, floats: null },
      pondStats: {
        temperature: 22.5,
        isFrozen: false,
        coordinates: [59.9, 10.7],
      },
      dailyActivities: ["Swim", "Line up"],
      features: {},
    });
    expect(inf.types.map((t) => t.name)).toEqual([
      "Root",
      "DuckConfig",
      "PondStats",
      "Features",
    ]);
    const root = inf.types[0];
    expect(root.fields.map((f) => f.key)).toEqual([
      "duckConfig",
      "pondStats",
      "dailyActivities",
      "features",
    ]);
    const duck = inf.types[1];
    expect(duck.fields.find((f) => f.key === "floats")?.shape.kind).toBe("any");
    const pond = inf.types[2];
    expect(pond.fields.find((f) => f.key === "temperature")?.shape.kind).toBe(
      "float",
    );
    expect(inf.types[3].fields).toEqual([]);
  });

  it("对象数组合并：部分缺席 → optional，null 混入 → nullable，int+float → float", () => {
    const inf = inferTypes({
      users: [
        { id: 1, name: "a", score: 1, tag: null },
        { id: 2, score: 1.5, tag: "x" },
      ],
    });
    const user = inf.types.find((t) => t.name === "User");
    expect(user).toBeDefined();
    const by = (k: string) => user?.fields.find((f) => f.key === k);
    expect(by("id")).toMatchObject({
      shape: { kind: "integer" },
      optional: false,
    });
    expect(by("name")).toMatchObject({ optional: true, nullable: false });
    expect(by("score")?.shape.kind).toBe("float");
    expect(by("tag")).toMatchObject({
      shape: { kind: "string" },
      nullable: true,
    });
  });

  it("数组根：预留 Root 给别名，元素类型叫 RootItem", () => {
    const inf = inferTypes([{ a: 1 }, { a: 2, b: "x" }]);
    expect(inf.root.kind).toBe("array");
    expect(inf.types.map((t) => t.name)).toEqual(["RootItem"]);
  });

  it("类型名冲突加数字后缀", () => {
    const inf = inferTypes({ item: { x: 1 }, nested: { item: { y: 2 } } });
    expect(inf.types.map((t) => t.name)).toEqual([
      "Root",
      "Item",
      "Nested",
      "Item2",
    ]);
  });

  it("混合标量数组 → any[]；空数组 → any[]；元素含 null → elementNullable", () => {
    const mixed = inferTypes({ a: [1, "x"], b: [], c: [1, null, 2] });
    const root = mixed.types[0];
    const by = (k: string) => root.fields.find((f) => f.key === k);
    expect(by("a")?.shape).toMatchObject({
      kind: "array",
      element: { kind: "any" },
    });
    expect(by("b")?.shape).toMatchObject({
      kind: "array",
      element: { kind: "any" },
    });
    expect(by("c")?.shape).toMatchObject({
      kind: "array",
      element: { kind: "integer" },
      elementNullable: true,
    });
  });

  it("Date 值（TOML/YAML 日期）按字符串", () => {
    const inf = inferTypes({ at: new Date(0) });
    expect(inf.types[0].fields[0].shape.kind).toBe("string");
  });
});
