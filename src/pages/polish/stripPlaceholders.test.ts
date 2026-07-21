import { describe, expect, it } from "vitest";
import { stripEmptyReportSections } from "./stripPlaceholders";

describe("stripEmptyReportSections", () => {
  it("删掉正文只有「暂无」的章节（连同标题）", () => {
    const md = `# 本周工作总结

## 核心进展

- 完成登录页修复。

## 风险与协作需求

暂无。`;
    const out = stripEmptyReportSections(md);
    expect(out).not.toContain("风险与协作需求");
    expect(out).not.toContain("暂无");
    expect(out).toContain("## 核心进展");
    expect(out).toContain("完成登录页修复。");
  });

  it("删掉完全没有正文的空章节", () => {
    const md = `# 本周工作总结

## 核心进展

- 完成登录页修复。

## 下周计划

`;
    const out = stripEmptyReportSections(md);
    expect(out).not.toContain("下周计划");
    expect(out).toContain("## 核心进展");
  });

  it("识别多种占位写法", () => {
    for (const ph of [
      "暂无",
      "无",
      "- 暂无",
      "**暂无**",
      "该部分暂无内容",
      "本周无风险",
      "无需协助",
      "无风险与协助事项",
      "（暂无）",
      "N/A",
    ]) {
      const md = `## 核心进展\n\n- 有内容。\n\n## 风险与协作需求\n\n${ph}`;
      const out = stripEmptyReportSections(md);
      expect(out, `占位「${ph}」应被删除`).not.toContain("风险与协作需求");
    }
  });

  it("保留含真实内容的章节（哪怕以「无」开头）", () => {
    const md = `## 下周计划

无重大计划，主要继续推进新接口联调。`;
    const out = stripEmptyReportSections(md);
    expect(out).toContain("下周计划");
    expect(out).toContain("无重大计划，主要继续推进新接口联调。");
  });

  it("保留有二级列表 / 多行内容的章节", () => {
    const md = `## 核心进展

- **登录模块**
  - 完成两个问题修复。`;
    const out = stripEmptyReportSections(md);
    expect(out).toContain("登录模块");
    expect(out).toContain("完成两个问题修复。");
  });

  it("没有 ## 章节的纯文本（朴实档日报）原样返回", () => {
    const md = "修了登录页的两个问题，和后端聊了下接口。";
    expect(stripEmptyReportSections(md)).toBe(md);
  });

  it("保留 h1 标题与前置文本", () => {
    const md = `# 本周工作总结

## 本周概览

本周推进顺利。

## 风险与协作需求

暂无`;
    const out = stripEmptyReportSections(md);
    expect(out.startsWith("# 本周工作总结")).toBe(true);
    expect(out).toContain("## 本周概览");
    expect(out).not.toContain("风险与协作需求");
  });

  it("病态情况：整篇都是占位则退回原文（不给空结果）", () => {
    const md = `## 核心进展

暂无

## 风险与协作需求

暂无`;
    // 全删会变空 → 兜底返回原文。
    expect(stripEmptyReportSections(md)).toBe(md.trim());
  });
});
