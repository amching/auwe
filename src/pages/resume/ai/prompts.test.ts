import { describe, expect, it } from "vitest";
import { extractSuggestion } from "./prompts";

describe("extractSuggestion", () => {
  it("干净输出原样返回", () => {
    const s = "1. 主导闪兑服务全链路交付。\n2. 独立搭建自成交系统。";
    expect(extractSuggestion(s)).toBe(s);
  });

  it("剥掉代码块围栏", () => {
    expect(extractSuggestion("```markdown\n# 张三\n```")).toBe("# 张三");
  });

  it("取 <output> 标签内的内容", () => {
    expect(
      extractSuggestion("好的：\n<output>\n改写后的内容\n</output>\n"),
    ).toBe("改写后的内容");
  });

  it("流式未闭合的 <output> 也能取到当前内容", () => {
    expect(extractSuggestion("<output>\n改写中的内容")).toBe("改写中的内容");
  });

  // 复现用户报告：模型回显整个 prompt 脚手架 + 自造【修改后】 + 残缺 << >> 定界符
  it("剥离回显的 prompt 脚手架，只留【修改后】之后的结果", () => {
    const echoed = `所在位置】工作经历 / GO软件开发工程师 / 量化部门 · gate.com / 第 1 条
【原文】
<<<
1. 闪兑服务：与策略顾问深度沟通，完美实现交付。
2. 独立完成自成交铺单、敲单业务。
>>>

【修改后】
<<
1. 闪兑服务开发：与策略顾问紧密合作，成功实现并交付项目。
2. 自成交业务开发：独立负责自成交铺单和敲单业务。
>>`;
    expect(extractSuggestion(echoed)).toBe(
      "1. 闪兑服务开发：与策略顾问紧密合作，成功实现并交付项目。\n2. 自成交业务开发：独立负责自成交铺单和敲单业务。",
    );
  });

  it("回显但无结果标签时，取最后一对定界符块", () => {
    const echoed = `需要改写的原文：
<<<
原文第一句。
>>>
<<<
改写后的第一句。
改写后的第二句。
>>>`;
    expect(extractSuggestion(echoed)).toBe(
      "改写后的第一句。\n改写后的第二句。",
    );
  });

  it("回显了开头但结果还没来（流式中间态）→ 返回空串，不把回显当结果", () => {
    const partial = `所在位置】工作经历 / 第 1 条
【原文】
<<<
原文内容还在`;
    expect(extractSuggestion(partial)).toBe("");
  });

  it("正常含 Markdown 语法的输出不被误伤", () => {
    const s = "### 高级工程师 · 某公司 | 2023 – 至今\n\n- **主导**核心重构。";
    expect(extractSuggestion(s)).toBe(s);
  });
});
