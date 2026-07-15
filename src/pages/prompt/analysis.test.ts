import { describe, expect, it } from "vitest";
import { locateFragment, parseAnalysis } from "./analysis";
import { buildDeconstructPrompt } from "./prompts";

const SOURCE = `请增加一个「AI 润色」功能。

## 背景
用户使用 Markdown 编写简历，描述偏流水账。

## 核心目标
通过 AI 的方式，对简历的部分字、段做润色，不偏离主旨。

## 约束
- 未经用户确认不得修改正文。`;

/** 组一个最小可通过校验的返回体，按需覆写。 */
function validPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    summary: { coreIntent: "为编辑器增加可控的 AI 润色流程。" },
    logicFlow: [
      {
        id: "x",
        category: "goal",
        title: "核心目标",
        summary: "润色但不偏离原意",
        purpose: "锚定最终结果",
        sourceFragments: [
          { text: "通过 AI 的方式，对简历的部分字、段做润色，不偏离主旨。" },
        ],
      },
    ],
    principles: ["先定义问题再定义功能"],
    skeleton: "## 目标\n【目标结果】",
    ...overrides,
  });
}

describe("locateFragment", () => {
  it("逐字匹配返回准确偏移", () => {
    const loc = locateFragment(SOURCE, "描述偏流水账");
    expect(loc).not.toBeNull();
    expect(SOURCE.slice(loc?.from, loc?.to)).toBe("描述偏流水账");
  });

  it("容忍首尾空白与引号", () => {
    expect(locateFragment(SOURCE, "  描述偏流水账 ")).not.toBeNull();
    expect(locateFragment(SOURCE, "“描述偏流水账”")).not.toBeNull();
  });

  it("空白容差：模型把换行抄成空格仍可定位", () => {
    const loc = locateFragment(SOURCE, "## 背景 用户使用 Markdown");
    expect(loc).not.toBeNull();
    expect(SOURCE.slice(loc?.from, loc?.to)).toContain("## 背景\n用户使用");
  });

  it("原文中不存在的片段返回 null", () => {
    expect(locateFragment(SOURCE, "这句话是编造的")).toBeNull();
  });
});

describe("parseAnalysis", () => {
  it("解析干净的 JSON", () => {
    const a = parseAnalysis(validPayload(), SOURCE);
    expect(a.summary.coreIntent).toContain("润色流程");
    expect(a.logicFlow).toHaveLength(1);
    expect(a.logicFlow[0].category).toBe("goal");
    expect(a.logicFlow[0].fragments).toHaveLength(1);
    expect(a.logicFlow[0].fragments[0].from).toBeGreaterThan(0);
  });

  it("容忍 Markdown 代码围栏与前后缀文字", () => {
    const raw = `好的，以下是解构结果：\n\`\`\`json\n${validPayload()}\n\`\`\``;
    expect(() => parseAnalysis(raw, SOURCE)).not.toThrow();
  });

  it("轻度损坏的 JSON 走 jsonrepair 兜底（尾逗号）", () => {
    const broken = validPayload().replace(
      '"skeleton"',
      '"extra": 1,"skeleton"',
    );
    // 人为制造尾逗号
    const withTrailing = broken.replace("]}", "],}").replace("]},", "],},");
    expect(() => parseAnalysis(withTrailing, SOURCE)).not.toThrow();
  });

  it("原文中找不到的片段被丢弃（反幻觉）", () => {
    const raw = validPayload({
      logicFlow: [
        {
          category: "goal",
          title: "核心目标",
          summary: "润色但不偏离原意",
          purpose: "锚定最终结果",
          sourceFragments: [
            { text: "这句原文依据是模型编造的" },
            { text: "未经用户确认不得修改正文" },
          ],
        },
      ],
    });
    const a = parseAnalysis(raw, SOURCE);
    expect(a.logicFlow[0].fragments).toHaveLength(1);
    expect(a.logicFlow[0].fragments[0].text).toBe("未经用户确认不得修改正文");
  });

  it("未知分类归入 other；片段允许纯字符串形式；id 本地重编", () => {
    const raw = validPayload({
      logicFlow: [
        {
          id: "dup",
          category: "nonsense",
          title: "某块",
          summary: "概括",
          sourceFragments: ["描述偏流水账"],
        },
        {
          id: "dup",
          category: "constraint",
          title: "约束",
          summary: "概括",
          sourceFragments: [],
        },
      ],
    });
    const a = parseAnalysis(raw, SOURCE);
    expect(a.logicFlow[0].category).toBe("other");
    expect(a.logicFlow[0].purpose).toBe("概括"); // purpose 缺失回退 summary
    expect(a.logicFlow.map((n) => n.id)).toEqual(["n0", "n1"]);
  });

  it("principles 超出 5 条被截断", () => {
    const raw = validPayload({
      principles: ["a", "b", "c", "d", "e", "f", "g"],
    });
    expect(parseAnalysis(raw, SOURCE).principles).toHaveLength(5);
  });

  it("缺关键字段时抛出中文错误", () => {
    expect(() => parseAnalysis("完全不是 JSON", SOURCE)).toThrow(/JSON/);
    expect(() => parseAnalysis(validPayload({ summary: {} }), SOURCE)).toThrow(
      /核心意图/,
    );
    expect(() =>
      parseAnalysis(validPayload({ logicFlow: [] }), SOURCE),
    ).toThrow(/结构节点/);
    expect(() => parseAnalysis(validPayload({ skeleton: "" }), SOURCE)).toThrow(
      /骨架/,
    );
  });
});

describe("buildDeconstructPrompt", () => {
  it("空输入抛错，正常输入包含边界标签与原文", () => {
    expect(() => buildDeconstructPrompt("   ")).toThrow();
    const p = buildDeconstructPrompt("给我写一个功能");
    expect(p).toContain("<user_prompt>\n给我写一个功能\n</user_prompt>");
    expect(p).toContain("sourceFragments");
  });
});
