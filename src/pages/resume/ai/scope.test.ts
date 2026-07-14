import { describe, expect, it } from "vitest";
import {
  describeScope,
  paragraphRangeAt,
  sectionRangeAt,
  type TextRange,
} from "./scope";

const DOC = `# 石青

demo@example.com · 上海

## 专业技能

- **后端**：Go、Java
- **云原生**：Kubernetes

## 工作经历

### 技术专家 · 某某科技 | 2021.03 – 至今

- 主导交易核心微服务化重构。
- 建设统一网关与流量治理平台。

### 高级后端工程师 · 某某网络 | 2018.07 – 2021.02

- 从 0 到 1 搭建支付清结算系统。
`;

const pos = (needle: string) => DOC.indexOf(needle);

function sliceRange(range: TextRange | null): string {
  if (!range) throw new Error("expected a range");
  return DOC.slice(range.from, range.to);
}

describe("describeScope", () => {
  it("覆盖全文 → 整份简历", () => {
    expect(describeScope(DOC, 0, DOC.length)).toBe("整份简历");
  });

  it("首个章节之前 → 基本信息", () => {
    const p = pos("demo@example.com");
    expect(describeScope(DOC, p, p + 4)).toBe("基本信息");
  });

  it("章节 / 条目 / 第 n 条", () => {
    const p = pos("建设统一网关");
    expect(describeScope(DOC, p, p + 4)).toBe(
      "工作经历 / 技术专家 · 某某科技 / 第 2 条",
    );
  });

  it("条目标题只取 | 前的主体", () => {
    const p = pos("从 0 到 1");
    expect(describeScope(DOC, p, p + 4)).toBe(
      "工作经历 / 高级后端工程师 · 某某网络 / 第 1 条",
    );
  });

  it("章节里的非条目列表只有章节名 + 序号", () => {
    const p = pos("**云原生**");
    expect(describeScope(DOC, p, p + 4)).toBe("专业技能 / 第 2 条");
  });
});

describe("paragraphRangeAt", () => {
  it("取到空行分隔的整个块", () => {
    const p = pos("- 主导交易");
    const range = paragraphRangeAt(DOC, p);
    expect(sliceRange(range)).toBe(
      "- 主导交易核心微服务化重构。\n- 建设统一网关与流量治理平台。",
    );
  });

  it("光标在空行时取上方最近的块", () => {
    const p = pos("\n\n### 高级");
    const range = paragraphRangeAt(DOC, p + 1);
    expect(sliceRange(range)).toContain("流量治理平台");
  });

  it("空文档返回 null", () => {
    expect(paragraphRangeAt("", 0)).toBeNull();
    expect(paragraphRangeAt("\n\n", 1)).toBeNull();
  });
});

describe("sectionRangeAt", () => {
  it("从 ## 起到下一个 ## 之前", () => {
    const p = pos("- 主导交易");
    const range = sectionRangeAt(DOC, p);
    const text = sliceRange(range);
    expect(text.startsWith("## 工作经历")).toBe(true);
    expect(text).toContain("支付清结算系统");
    expect(text).not.toContain("专业技能");
  });

  it("首个 ## 之前的位置归入开头块", () => {
    const range = sectionRangeAt(DOC, pos("demo@example.com"));
    const text = sliceRange(range);
    expect(text.startsWith("# 石青")).toBe(true);
    expect(text).not.toContain("专业技能");
  });
});
