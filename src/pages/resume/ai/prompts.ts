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
    ? `\n【当前改写版本（请在此版本基础上继续修改）】\n<<<\n${base}\n>>>\n`
    : "";
  return `你是一位资深的中文简历写作顾问。请按要求改写下面这段简历内容（Markdown 片段）。

【所在位置】${scope}
【原文】
<<<
${original}
>>>
${baseBlock}
【修改要求】${instruction}

规则：
- 只输出改写后的 Markdown 片段本身：不要解释、不要客套话、不要代码块围栏、不要多余的前后引号。
- 保持原有 Markdown 结构（标题层级、列表符号、加粗语法、HTML 注释）不变，除非修改要求里明确提出调整。
- 不得虚构原文中不存在的事实、数字、公司或技术名词。
- 输出语言与原文一致。`;
}

/** 模型偶尔无视指令包一层代码块围栏，剥掉它。 */
export function stripCodeFence(text: string): string {
  const t = text.trim();
  const match = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(t);
  return match ? match[1] : t;
}
