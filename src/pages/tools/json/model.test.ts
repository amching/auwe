import { describe, expect, it } from "vitest";
import {
  buildTree,
  DEFAULT_SEARCH_SETTINGS,
  flattenVisible,
  makeMatcher,
  searchTree,
} from "./model";

const SAMPLE = {
  duckConfig: { name: "Quack Overflow", hasGlasses: true, floats: null },
  pondStats: {
    temperature: 22.5,
    isFrozen: false,
    coordinates: [59.9139, 10.7522],
  },
  dailyActivities: ["Swim", "Debug fountain"],
  features: {},
};

describe("buildTree", () => {
  it("构建根与子节点，childCount 正确", () => {
    const { root, nodeCount } = buildTree(SAMPLE);
    expect(root.type).toBe("object");
    expect(root.childCount).toBe(4);
    expect(root.children.map((c) => c.key)).toEqual([
      "duckConfig",
      "pondStats",
      "dailyActivities",
      "features",
    ]);
    // 1(根) + 4 + 3 + 3+2 + 2 = 15
    expect(nodeCount).toBe(15);
  });

  it("路径稳定且转义 / 与 ~", () => {
    const { root } = buildTree({ "a/b": { "c~d": 1 } });
    const child = root.children[0];
    expect(child.path).toBe("/a~1b");
    expect(child.children[0].path).toBe("/a~1b/c~0d");
  });

  it("原始值文本：string 不带引号，null/boolean/number 为字面量", () => {
    const { root } = buildTree({ s: "hi", n: 1.5, b: false, z: null });
    expect(root.children.map((c) => c.text)).toEqual([
      "hi",
      "1.5",
      "false",
      "null",
    ]);
    expect(root.children.map((c) => c.type)).toEqual([
      "string",
      "number",
      "boolean",
      "null",
    ]);
  });

  it("深层嵌套不爆栈", () => {
    let v: unknown = 1;
    for (let i = 0; i < 20000; i++) v = [v];
    const { nodeCount } = buildTree(v);
    expect(nodeCount).toBe(20001);
  });
});

describe("flattenVisible", () => {
  const { root } = buildTree(SAMPLE);

  it("仅根展开：根 open + 4 个折叠子行 + 根 close", () => {
    const rows = flattenVisible(root, (n) => n.depth === 0, null);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ kind: "open", expanded: true });
    expect(rows[5]).toMatchObject({ kind: "close" });
    expect(rows[1].expanded).toBe(false);
  });

  it("空容器不算可展开", () => {
    const rows = flattenVisible(root, () => true, null);
    const features = rows.find(
      (r) => r.node.key === "features" && r.kind === "open",
    );
    expect(features?.expanded).toBe(false);
  });

  it("全部展开时包含 close 行且顺序正确", () => {
    const rows = flattenVisible(root, () => true, null);
    const texts = rows.map((r) => `${r.kind}:${r.node.path}`);
    const openDuck = texts.indexOf("open:/duckConfig");
    const closeDuck = texts.indexOf("close:/duckConfig");
    expect(openDuck).toBeGreaterThan(0);
    expect(closeDuck).toBe(openDuck + 4); // 3 个子行之后
  });
});

describe("makeMatcher / searchTree", () => {
  const { root } = buildTree(SAMPLE);

  it("includes 默认不区分大小写", () => {
    const { matcher } = makeMatcher("quack", DEFAULT_SEARCH_SETTINGS);
    expect(matcher).not.toBeNull();
    if (!matcher) return;
    const res = searchTree(root, matcher, DEFAULT_SEARCH_SETTINGS);
    expect(res.count).toBe(1);
    expect(res.matched.has("/duckConfig/name")).toBe(true);
    // 祖先被保留
    expect(res.kept.has("/duckConfig")).toBe(true);
    expect(res.kept.has("")).toBe(true);
  });

  it("区分大小写时 quack 不命中 Quack", () => {
    const settings = { ...DEFAULT_SEARCH_SETTINGS, caseSensitive: true };
    const { matcher } = makeMatcher("quack", settings);
    if (!matcher) throw new Error("matcher null");
    expect(searchTree(root, matcher, settings).count).toBe(0);
  });

  it("只匹配键名 / 只匹配值", () => {
    const keysOnly = { ...DEFAULT_SEARCH_SETTINGS, matchValues: false };
    const { matcher: m1 } = makeMatcher("temperature", keysOnly);
    if (!m1) throw new Error("matcher null");
    expect(searchTree(root, m1, keysOnly).count).toBe(1);

    const valuesOnly = { ...DEFAULT_SEARCH_SETTINGS, matchKeys: false };
    const { matcher: m2 } = makeMatcher("temperature", valuesOnly);
    if (!m2) throw new Error("matcher null");
    expect(searchTree(root, m2, valuesOnly).count).toBe(0);
  });

  it("equals 全等匹配", () => {
    const settings = {
      ...DEFAULT_SEARCH_SETTINGS,
      stringMode: "equals" as const,
    };
    const { matcher } = makeMatcher("swim", settings);
    if (!matcher) throw new Error("matcher null");
    const res = searchTree(root, matcher, settings);
    expect(res.count).toBe(1);
    expect(res.matched.has("/dailyActivities/0")).toBe(true);
  });

  it("regex 模式 + 语法错误返回 error", () => {
    const settings = {
      ...DEFAULT_SEARCH_SETTINGS,
      stringMode: "regex" as const,
    };
    const ok = makeMatcher("^is[A-Z]", settings);
    expect(ok.error).toBeNull();
    if (!ok.matcher) throw new Error("matcher null");
    const res = searchTree(root, ok.matcher, settings);
    expect(res.count).toBe(1); // isFrozen（hasGlasses 不以 is 开头）
    const bad = makeMatcher("([", settings);
    expect(bad.matcher).toBeNull();
    expect(bad.error).toBe("正则表达式无效");
  });

  it("空查询返回 null matcher（不搜索）", () => {
    const { matcher, error } = makeMatcher("", DEFAULT_SEARCH_SETTINGS);
    expect(matcher).toBeNull();
    expect(error).toBeNull();
  });

  it("ranges 给出高亮区间", () => {
    const { matcher } = makeMatcher("o", DEFAULT_SEARCH_SETTINGS);
    if (!matcher) throw new Error("matcher null");
    expect(matcher.ranges("foo")).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });

  it("过滤扁平化：只保留命中路径，命中容器的子树整棵保留", () => {
    const { matcher } = makeMatcher("pondStats", DEFAULT_SEARCH_SETTINGS);
    if (!matcher) throw new Error("matcher null");
    const res = searchTree(root, matcher, DEFAULT_SEARCH_SETTINGS);
    const rows = flattenVisible(root, () => true, res);
    const paths = rows.filter((r) => r.kind === "open").map((r) => r.node.path);
    expect(paths).toContain("/pondStats");
    expect(paths).toContain("/pondStats/temperature"); // 命中容器的子节点保留
    expect(paths).not.toContain("/duckConfig");
  });
});
