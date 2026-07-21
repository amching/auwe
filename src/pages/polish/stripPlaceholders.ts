// 生成后的确定性清洗（纯函数，便于单测）。
//
// 提示词里已经明确要求「用户没填的分区整节删掉、不要写『暂无』占位」，但模型并不
// 总是照办——仍会冒出「## 风险与协作需求\n\n暂无。」这种空壳章节。这里在**内容层**
// 兜底：把「正文只剩占位词」或「完全没有正文」的 ## 章节连同标题一起删掉。
//
// 只动 h2（##）章节，保留 h1 标题与任何前置内容；判定保守——只有当一个章节的**每一行
// 实质内容**都是占位词时才删，含有真实句子的章节（哪怕以「无」开头）一律保留。

/** 把一行正文归一化：去掉列表符号、加粗、引号括号、首尾标点与空白，便于匹配占位词。 */
function normalizeLine(line: string): string {
  return line
    .replace(/^[\s>*+-]+/, "") // 列表符号 / 引用符
    .replace(/\*\*/g, "") // 加粗
    .replace(/[「」『』（）()[\]【】《》"'`]/g, "") // 各类括号与引号
    .replace(/^[\s、，,。.；;：:！!]+/, "") // 前导标点
    .replace(/[\s、，,。.；;：:！!~～]+$/, "") // 尾随标点
    .trim();
}

// 完全等于这些（归一化后）即视为占位。
const EXACT_PLACEHOLDERS = new Set([
  "暂无",
  "无",
  "略",
  "无内容",
  "暂无内容",
  "暂无信息",
  "该部分暂无内容",
  "该部分暂无",
  "本周无",
  "无需协助",
  "无风险",
  "na",
  "n/a",
  "none",
  "nil",
  "null",
  "-",
  "—",
  "/",
]);

/** 判断一行（已 trim 的原始行）是否只是占位词，而非真实内容。 */
function isPlaceholderLine(rawLine: string): boolean {
  const norm = normalizeLine(rawLine);
  if (!norm) return true; // 归一化后为空（只有符号）也算空
  const lower = norm.toLowerCase();
  if (EXACT_PLACEHOLDERS.has(lower)) return true;
  // 含逗号 / 句号说明是完整句子（有真实内容），不当作占位。
  if (/[，,。.！!？?；;]/.test(norm)) return false;
  // 「本周无X」「本周暂无X」这类短语（不含标点、较短）。
  if (/^本周(暂)?无.{0,12}$/.test(norm)) return true;
  // 「(暂)无+(需)+…风险/协助/计划/事项…」这类短语。
  if (
    /^(暂无|无)(需)?.{0,10}(风险|协助|支持|计划|事项|安排|内容|阻塞|事宜|问题)$/.test(
      norm,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * 删除「空的」或「正文只有占位词」的 ## 章节（含其标题）。
 * 保留 h1 标题与前置文本；判定保守，绝不删含真实内容的章节。
 * 若清洗后正文被删空（模型整篇都是占位这种病态情况），返回原文兜底。
 */
export function stripEmptyReportSections(markdown: string): string {
  const lines = markdown.split("\n");
  const isH2 = (l: string) => /^##\s+/.test(l);

  const head: string[] = [];
  const sections: { heading: string; body: string[] }[] = [];
  let started = false;

  for (const line of lines) {
    if (isH2(line)) {
      sections.push({ heading: line, body: [] });
      started = true;
    } else if (started) {
      sections[sections.length - 1].body.push(line);
    } else {
      head.push(line);
    }
  }

  // 没有任何 ## 章节（如朴实档的纯文本日报）——原样返回。
  if (sections.length === 0) return markdown;

  const kept = sections.filter(({ body }) => {
    const content = body.map((l) => l.trim()).filter((l) => l.length > 0);
    if (content.length === 0) return false; // 空章节
    return !content.every(isPlaceholderLine); // 全是占位 → 删
  });

  const parts: string[] = [];
  const headText = head.join("\n").trim();
  if (headText) parts.push(headText);
  for (const { heading, body } of kept) {
    parts.push(`${heading}\n\n${body.join("\n").trim()}`);
  }

  const result = parts.join("\n\n").trim();
  // 兜底：清洗把内容删空了就退回原文，别给用户一个空结果。
  return result || markdown.trim();
}
