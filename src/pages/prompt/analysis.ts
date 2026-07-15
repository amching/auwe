import { jsonrepair } from "jsonrepair";

/**
 * Prompt 解构的数据模型 + AI 返回解析/校验 + 原文定位（纯逻辑，有单测）。
 *
 * 反幻觉红线：AI 给出的 sourceFragments 只有在原文里逐字找得到（允许空白差异、
 * 首尾引号差异）才保留；定位失败的片段直接丢弃，绝不把编造的「原文依据」摆给用户。
 */

export const FLOW_CATEGORIES = [
  "context",
  "problem",
  "goal",
  "task",
  "interaction",
  "constraint",
  "visual",
  "technical",
  "output",
  "acceptance",
  "other",
] as const;

export type FlowCategory = (typeof FLOW_CATEGORIES)[number];

/** 分类展示元信息。颜色只做辅助区分（Badge 淡染），标签文字才是主要载体。 */
export const CATEGORY_META: Record<
  FlowCategory,
  { label: string; badgeClass: string }
> = {
  context: {
    label: "背景",
    badgeClass: "bg-secondary text-secondary-foreground",
  },
  problem: { label: "问题", badgeClass: "bg-warning/10 text-warning" },
  goal: { label: "目标", badgeClass: "bg-primary/10 text-primary" },
  task: { label: "功能", badgeClass: "bg-info/10 text-info" },
  interaction: { label: "交互", badgeClass: "bg-info/10 text-info" },
  constraint: {
    label: "约束",
    badgeClass: "bg-destructive/10 text-destructive",
  },
  visual: { label: "视觉", badgeClass: "bg-success/10 text-success" },
  technical: { label: "技术", badgeClass: "bg-info/10 text-info" },
  output: { label: "输出", badgeClass: "bg-success/10 text-success" },
  acceptance: { label: "验收", badgeClass: "bg-primary/10 text-primary" },
  other: {
    label: "其他",
    badgeClass: "bg-secondary text-secondary-foreground",
  },
};

/** 已在原文中定位成功的片段；from/to 是原文字符偏移，text 取自原文本身。 */
export interface LocatedFragment {
  text: string;
  from: number;
  to: number;
}

export interface FlowNode {
  id: string;
  category: FlowCategory;
  title: string;
  summary: string;
  purpose: string;
  fragments: LocatedFragment[];
  riskIfMissing?: string;
}

export interface PromptSummary {
  coreIntent: string;
  taskType?: string;
  target?: string;
  deliverable?: string;
}

export interface PromptAnalysis {
  summary: PromptSummary;
  logicFlow: FlowNode[];
  principles: string[];
  skeleton: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 在原文中定位 AI 摘录的片段。依次尝试：
 * 1) 逐字精确匹配；2) 去首尾空白；3) 去 AI 顺手加上的首尾引号；
 * 4) 空白容差匹配（模型常把换行抄成空格：非空白部分逐字，空白串视为等价）。
 * 全部失败返回 null——调用方按「编造」丢弃。
 */
export function locateFragment(
  source: string,
  fragment: string,
): { from: number; to: number } | null {
  const candidates = [fragment, fragment.trim()];
  const unquoted = fragment
    .trim()
    .replace(/^[「『“”"'…]+/, "")
    .replace(/[」』“”"'…]+$/, "");
  if (unquoted) candidates.push(unquoted);

  for (const c of candidates) {
    if (!c) continue;
    const idx = source.indexOf(c);
    if (idx >= 0) return { from: idx, to: idx + c.length };
  }

  const parts = (unquoted || fragment.trim()).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const re = new RegExp(parts.map(escapeRegExp).join("\\s+"));
  const m = re.exec(source);
  if (m) return { from: m.index, to: m.index + m[0].length };
  return null;
}

/** 去掉模型偶尔包裹的 Markdown 代码围栏。 */
function stripFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```\s*$/.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

/** 尽力把模型输出还原成 JSON：剥围栏 → 截取最外层 {} → 直接 parse → jsonrepair 兜底。 */
function parseJson(raw: string): unknown {
  const stripped = stripFence(raw);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const candidate =
    start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(jsonrepair(candidate));
  }
}

const asString = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/**
 * 解析并校验 AI 返回的解构结果（source 为用户输入的 Prompt 原文，用于片段定位）。
 * 校验失败抛 Error（message 是给用户看的中文）；调用方据此走「无法解析」错误态。
 */
export function parseAnalysis(raw: string, source: string): PromptAnalysis {
  let data: unknown;
  try {
    data = parseJson(raw);
  } catch {
    throw new Error("模型没有返回可解析的 JSON");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("模型返回的不是 JSON 对象");
  }
  const obj = data as Record<string, unknown>;

  const summaryRaw = (
    typeof obj.summary === "object" && obj.summary !== null ? obj.summary : {}
  ) as Record<string, unknown>;
  const coreIntent = asString(summaryRaw.coreIntent);
  if (!coreIntent) throw new Error("结果缺少核心意图");

  const flowRaw = Array.isArray(obj.logicFlow) ? obj.logicFlow : [];
  const logicFlow: FlowNode[] = [];
  for (const item of flowRaw) {
    if (typeof item !== "object" || item === null) continue;
    const n = item as Record<string, unknown>;
    const title = asString(n.title);
    const summary = asString(n.summary);
    if (!title || !summary) continue; // 缺关键字段的节点丢弃，不让半成品进 UI
    const category = (FLOW_CATEGORIES as readonly string[]).includes(
      n.category as string,
    )
      ? (n.category as FlowCategory)
      : "other";

    const fragmentsRaw = Array.isArray(n.sourceFragments)
      ? n.sourceFragments
      : [];
    const fragments: LocatedFragment[] = [];
    for (const f of fragmentsRaw) {
      const text =
        typeof f === "string"
          ? asString(f)
          : asString((f as Record<string, unknown> | null)?.text);
      if (!text) continue;
      const loc = locateFragment(source, text);
      if (!loc) continue;
      fragments.push({
        text: source.slice(loc.from, loc.to),
        from: loc.from,
        to: loc.to,
      });
    }

    logicFlow.push({
      // id 本地重新生成，不信任模型给的（可能重复/缺失）
      id: `n${logicFlow.length}`,
      category,
      title,
      summary,
      purpose: asString(n.purpose) ?? summary,
      fragments,
      riskIfMissing: asString(n.riskIfMissing),
    });
  }
  if (logicFlow.length === 0) throw new Error("结果缺少有效的结构节点");

  const principles = (Array.isArray(obj.principles) ? obj.principles : [])
    .flatMap((p) => {
      const s = asString(p);
      return s ? [s] : [];
    })
    .slice(0, 5);

  const skeleton = asString(obj.skeleton);
  if (!skeleton) throw new Error("结果缺少 Prompt 骨架");

  return {
    summary: {
      coreIntent,
      taskType: asString(summaryRaw.taskType),
      target: asString(summaryRaw.target),
      deliverable: asString(summaryRaw.deliverable),
    },
    logicFlow,
    principles,
    skeleton,
  };
}
