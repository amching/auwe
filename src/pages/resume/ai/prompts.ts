/** 简历 AI 优化的指令与 prompt 组装（纯函数）。 */

export interface QuickAction {
  id: string;
  label: string;
  instruction: string;
}

/** 面板里的快捷指令（选区浮动工具条复用其中前三个，label 略有不同）。 */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "concise",
    label: "更精炼",
    instruction: "在不丢失关键信息的前提下更精炼，删掉冗余修饰和重复表达。",
  },
  {
    id: "professional",
    label: "更专业",
    instruction: "用更专业、书面化的措辞改写，符合技术简历的行文习惯。",
  },
  {
    id: "impact",
    label: "突出成果",
    instruction: "强化成果导向：动词开头，突出量化结果与业务影响。",
  },
  {
    id: "concrete",
    label: "减少套话",
    instruction: "去掉空洞套话和主观形容词，用具体的事实与数据表达。",
  },
];

export interface ResumeAiPromptInput {
  /** 用户选中的原文（Markdown 片段）。 */
  original: string;
  /** 结构面包屑，如「工作经历 / 某某科技 / 第 2 条」。 */
  scope: string;
  /** 本轮修改要求（快捷指令或用户输入）。 */
  instruction: string;
  /** 多轮调整时，上一轮的改写结果（在其基础上继续改）。 */
  base?: string;
}

export function buildResumeAiPrompt({
  original,
  scope,
  instruction,
  base,
}: ResumeAiPromptInput): string {
  const baseBlock = base
    ? `\n当前改写版本（请在此版本基础上继续修改）：\n${base}\n`
    : "";
  return `你是一位资深的中文简历写作顾问。请按要求改写下面这段简历内容（Markdown 片段）。

所在位置：${scope}

需要改写的原文：
${original}
${baseBlock}
修改要求：${instruction}

规则：
- 把改写后的 Markdown 片段放在 <output> 和 </output> 之间。
- <output> 内只放改写结果本身，不要复述原文、所在位置或修改要求，不要任何解释、客套话、代码块围栏或额外标签。
- 保持原有 Markdown 结构（标题层级、列表符号、加粗语法、HTML 注释）不变，除非修改要求里明确提出调整。
- 不得虚构原文中不存在的事实、数字、公司或技术名词。
- 输出语言与原文一致。

示例格式：
<output>
改写后的内容
</output>`;
}

/** 模型偶尔无视指令包一层代码块围栏，剥掉它。 */
export function stripCodeFence(text: string): string {
  const t = text.trim();
  const match = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(t);
  return match ? match[1] : t;
}

// 结果小标题：模型回显 prompt 时常自造这类「改写后」标签，其后才是真正的答案。
const RESULT_LABEL =
  /【\s*(?:修改后|修改结果|改写后|改写结果|优化后|润色后|输出结果|结果|输出)\s*[:：]?\s*】/;

// prompt 脚手架信号：正常改写不会包含这些（原文标签 / 定界符）。
function looksEchoed(text: string): boolean {
  return (
    text.includes("【原文】") ||
    text.includes("需要改写的原文") ||
    text.includes("<<<") ||
    /所在位置\s*】/.test(text) ||
    /【\s*所在位置/.test(text)
  );
}

/** 取最后一对定界符（<<< … >>> 或 << … >>）内的内容；回显结构里它就是结果块。 */
function lastFencedBlock(text: string): string | null {
  const re =
    /(?:^|\n)[ \t]*<{2,3}[ \t]*\n([\s\S]*?)\n[ \t]*>{2,3}[ \t]*(?=\n|$)/g;
  let m: RegExpExecArray | null;
  let last: string | null = null;
  // biome-ignore lint/suspicious/noAssignInExpressions: 惯用的 regex 逐个匹配
  while ((m = re.exec(text)) !== null) last = m[1];
  return last;
}

/** 去掉只由定界符（<< / <<< / >> / >>>）组成的行。 */
function stripDelimiterLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^[ \t]*(?:<{2,3}|>{2,3})[ \t]*$/.test(line))
    .join("\n")
    .trim();
}

/**
 * 从模型返回中提取「改写后的片段本身」。分层兜底，越靠前越可信：
 * 1. <output>…</output>：prompt 要求的显式标记（流式未闭合时取到结尾）。
 * 2. 代码块围栏。
 * 3. 模型回显了整个 prompt 时：优先取自造的「改写后」小标题之后，
 *    否则取最后一对定界符块（回显里原文在前、结果在后）；都识别不到则
 *    判为「结果尚未产出」返回空串（流式中间态，避免把回显当结果写回）。
 * 关键：只有检测到强回显信号（【原文】/<<< 等）才做第 3 步，正常输出原样返回，
 * 从而杜绝「把 prompt 脚手架应用进简历」这类脏写。
 */
export function extractSuggestion(raw: string): string {
  let text = raw.trim();

  const tagged = /<output>\s*([\s\S]*?)(?:<\/output>|$)/i.exec(text);
  if (tagged) text = tagged[1].trim();

  text = stripCodeFence(text);

  if (looksEchoed(text)) {
    const label = RESULT_LABEL.exec(text);
    if (label) {
      text = text.slice(label.index + label[0].length);
    } else {
      const block = lastFencedBlock(text);
      if (block !== null) text = block;
      else return "";
    }
  }

  return stripDelimiterLines(text);
}
