/**
 * JSON 树视图的数据模型：解析结果 → 节点树 → 可见行扁平化 → 搜索/过滤。
 * 全部为纯函数，供 JsonTree 虚拟化渲染使用；性能约定：
 * - buildTree / searchTree 每次解析或查询变化各跑一遍，O(节点数)；
 * - flattenVisible 只产出「当前可见」的行，配合窗口化渲染，大文档不卡。
 */

export type JsonNodeType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "null";

export interface JsonNode {
  /** JSON Pointer 风格路径（"" 为根；段内 ~→~0、/→~1 转义），跨编辑保持稳定，作展开状态的 key。 */
  path: string;
  parentPath: string | null;
  /** 对象成员的键名（数组元素与根为 null）。 */
  key: string | null;
  /** 数组元素的下标（其余为 null）。 */
  index: number | null;
  depth: number;
  type: JsonNodeType;
  /** 原始值文本：string 不带引号，number/boolean/null 为字面量；容器为 ""。 */
  text: string;
  children: JsonNode[];
  childCount: number;
}

function escapeSegment(seg: string): string {
  return seg.replace(/~/g, "~0").replace(/\//g, "~1");
}

function typeOf(value: unknown): JsonNodeType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "object") return "object";
  if (t === "string") return "string";
  if (t === "number") return "number";
  return "boolean";
}

/** 把 JSON.parse 的结果构建为节点树。迭代式（显式栈），深文档不会爆调用栈。 */
export function buildTree(value: unknown): {
  root: JsonNode;
  nodeCount: number;
} {
  const root: JsonNode = {
    path: "",
    parentPath: null,
    key: null,
    index: null,
    depth: 0,
    type: typeOf(value),
    text: "",
    children: [],
    childCount: 0,
  };
  let nodeCount = 1;
  const stack: { node: JsonNode; value: unknown }[] = [{ node: root, value }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) break;
    const { node, value: v } = frame;
    if (node.type === "object" || node.type === "array") {
      const entries: [string | null, number | null, unknown][] =
        node.type === "array"
          ? (v as unknown[]).map((item, i) => [null, i, item])
          : Object.entries(v as Record<string, unknown>).map(([k, item]) => [
              k,
              null,
              item,
            ]);
      node.childCount = entries.length;
      for (const [key, index, item] of entries) {
        const seg = key !== null ? escapeSegment(key) : String(index);
        const child: JsonNode = {
          path: `${node.path}/${seg}`,
          parentPath: node.path,
          key,
          index,
          depth: node.depth + 1,
          type: typeOf(item),
          text: "",
          children: [],
          childCount: 0,
        };
        nodeCount++;
        node.children.push(child);
        if (child.type === "object" || child.type === "array") {
          stack.push({ node: child, value: item });
        } else {
          child.text = item === null ? "null" : String(item);
        }
      }
    } else {
      node.text = v === null ? "null" : String(v);
    }
  }
  return { root, nodeCount };
}

// ---------------------------------------------------------------------------
// 搜索
// ---------------------------------------------------------------------------

export type FilterMode = "auto" | "filter" | "highlight";
export type StringMode = "includes" | "equals" | "regex";

export interface SearchSettings {
  filterMode: FilterMode;
  stringMode: StringMode;
  matchKeys: boolean;
  matchValues: boolean;
  caseSensitive: boolean;
}

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  filterMode: "auto",
  stringMode: "includes",
  matchKeys: true,
  matchValues: true,
  caseSensitive: false,
};

export interface Matcher {
  /** 是否命中整个文本。 */
  test(text: string): boolean;
  /** 命中的字符区间（用于高亮）；equals 命中即整串。 */
  ranges(text: string): [number, number][];
}

/**
 * 根据查询与设置构造匹配器。
 * 返回 null 表示「无有效查询」（空串，或正则语法错误——由 error 区分）。
 */
export function makeMatcher(
  query: string,
  settings: SearchSettings,
): { matcher: Matcher | null; error: string | null } {
  if (query === "") return { matcher: null, error: null };

  if (settings.stringMode === "regex") {
    let re: RegExp;
    try {
      re = new RegExp(query, settings.caseSensitive ? "g" : "gi");
    } catch {
      return { matcher: null, error: "正则表达式无效" };
    }
    return {
      matcher: {
        test(text) {
          re.lastIndex = 0;
          return re.test(text);
        },
        ranges(text) {
          re.lastIndex = 0;
          const out: [number, number][] = [];
          for (const m of text.matchAll(re)) {
            if (m[0] === "") break; // 空匹配防死循环
            out.push([m.index, m.index + m[0].length]);
          }
          return out;
        },
      },
      error: null,
    };
  }

  const norm = (s: string) => (settings.caseSensitive ? s : s.toLowerCase());
  const q = norm(query);

  if (settings.stringMode === "equals") {
    return {
      matcher: {
        test: (text) => norm(text) === q,
        ranges: (text) => (norm(text) === q ? [[0, text.length]] : []),
      },
      error: null,
    };
  }

  // includes
  return {
    matcher: {
      test: (text) => norm(text).includes(q),
      ranges(text) {
        const hay = norm(text);
        const out: [number, number][] = [];
        let from = 0;
        while (true) {
          const at = hay.indexOf(q, from);
          if (at === -1) break;
          out.push([at, at + q.length]);
          from = at + q.length;
        }
        return out;
      },
    },
    error: null,
  };
}

export interface SearchResult {
  /** 自身命中（键名或值）的节点路径。 */
  matched: Set<string>;
  /** 命中节点 + 其全部祖先：过滤模式下的可见集合，也用于自动展开。 */
  kept: Set<string>;
  /** 命中节点数。 */
  count: number;
}

/** 节点自身是否命中（键名 / 原始值文本）。 */
export function nodeMatches(
  node: JsonNode,
  matcher: Matcher,
  settings: SearchSettings,
): boolean {
  if (settings.matchKeys && node.key !== null && matcher.test(node.key)) {
    return true;
  }
  if (
    settings.matchValues &&
    node.type !== "object" &&
    node.type !== "array" &&
    matcher.test(node.text)
  ) {
    return true;
  }
  return false;
}

/** 全树搜索：返回命中集与「命中+祖先」保留集。 */
export function searchTree(
  root: JsonNode,
  matcher: Matcher,
  settings: SearchSettings,
): SearchResult {
  const matched = new Set<string>();
  const kept = new Set<string>();
  const stack: JsonNode[] = [root];
  // 记录 parentPath 映射以便向上补祖先（避免每个命中都重走一遍字符串切分）。
  const parentOf = new Map<string, string | null>();

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    parentOf.set(node.path, node.parentPath);
    if (nodeMatches(node, matcher, settings)) {
      matched.add(node.path);
      let p: string | null = node.path;
      while (p !== null && !kept.has(p)) {
        kept.add(p);
        p = parentOf.get(p) ?? parentPathOf(p);
      }
    }
    for (const child of node.children) stack.push(child);
  }
  return { matched, kept, count: matched.size };
}

/** 从路径推导父路径（"" 的父为 null）。 */
function parentPathOf(path: string): string | null {
  if (path === "") return null;
  const at = path.lastIndexOf("/");
  return at <= 0 ? "" : path.slice(0, at);
}

// ---------------------------------------------------------------------------
// 可见行扁平化（虚拟化渲染的输入）
// ---------------------------------------------------------------------------

export interface FlatRow {
  node: JsonNode;
  /** open：节点行（容器或原始值）；close：展开容器的收尾括号行。 */
  kind: "open" | "close";
  /** 容器行当前是否展开（close 行恒为 true）。 */
  expanded: boolean;
}

/**
 * 按展开状态（+ 可选过滤）产出可见行。
 * 过滤语义：保留「命中节点、其祖先、命中容器的整棵子树」；其余剪掉。
 */
export function flattenVisible(
  root: JsonNode,
  isExpanded: (node: JsonNode) => boolean,
  filter: SearchResult | null,
): FlatRow[] {
  const rows: FlatRow[] = [];
  // 显式栈模拟先序遍历；close 帧在 children 之后弹出。
  type Frame =
    | { kind: "node"; node: JsonNode; insideMatch: boolean }
    | { kind: "close"; node: JsonNode };
  const stack: Frame[] = [{ kind: "node", node: root, insideMatch: false }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) break;
    if (frame.kind === "close") {
      rows.push({ node: frame.node, kind: "close", expanded: true });
      continue;
    }
    const { node } = frame;
    const insideMatch =
      frame.insideMatch || (filter?.matched.has(node.path) ?? false);
    if (filter && !insideMatch && !filter.kept.has(node.path)) continue;

    const isContainer = node.type === "object" || node.type === "array";
    const expanded = isContainer && node.childCount > 0 && isExpanded(node);
    rows.push({ node, kind: "open", expanded });
    if (expanded) {
      stack.push({ kind: "close", node });
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ kind: "node", node: node.children[i], insideMatch });
      }
    }
  }
  return rows;
}
