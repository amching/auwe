/**
 * 轻量 token 级文本 diff（纯函数，供编辑器内联审阅用）。
 * 中文按字、英文/数字按词、空白成段地切 token，再做 LCS 对齐——
 * 简历片段体量小（几百 token），DP 足够；超大输入退化为整段替换，不追求最优。
 */

export interface DiffSegment {
  type: "same" | "del" | "add";
  text: string;
}

/** 英文词 / 数字串保持整体，空白成段，其余（含 CJK）逐字符。 */
export function tokenize(text: string): string[] {
  return text.match(/[A-Za-z0-9_]+|\s+|[\s\S]/g) ?? [];
}

// LCS DP 的规模上限（m*n）。超过则不做细粒度对齐，直接整段替换。
const MAX_DP_CELLS = 1_000_000;

/** 对比原文与改写结果，输出顺序化的 same/del/add 片段（相邻同类已合并）。 */
export function diffText(a: string, b: string): DiffSegment[] {
  if (a === b) return a ? [{ type: "same", text: a }] : [];

  const ta = tokenize(a);
  const tb = tokenize(b);

  // 先掐掉公共前后缀，缩小 DP 规模（也让整段替换的退化更聚焦）。
  let start = 0;
  while (start < ta.length && start < tb.length && ta[start] === tb[start]) {
    start++;
  }
  let endA = ta.length;
  let endB = tb.length;
  while (endA > start && endB > start && ta[endA - 1] === tb[endB - 1]) {
    endA--;
    endB--;
  }

  const midA = ta.slice(start, endA);
  const midB = tb.slice(start, endB);

  const out: DiffSegment[] = [];
  const push = (type: DiffSegment["type"], text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };

  push("same", ta.slice(0, start).join(""));

  if (midA.length === 0 || midB.length === 0) {
    push("del", midA.join(""));
    push("add", midB.join(""));
  } else if (midA.length * midB.length > MAX_DP_CELLS) {
    push("del", midA.join(""));
    push("add", midB.join(""));
  } else {
    for (const seg of lcsDiff(midA, midB)) push(seg.type, seg.text);
  }

  push("same", ta.slice(endA).join(""));
  return out;
}

/** 经典 LCS 回溯：删除先于新增输出（同一处替换显示为「划掉旧 + 插入新」）。 */
function lcsDiff(a: string[], b: string[]): DiffSegment[] {
  const m = a.length;
  const n = b.length;
  const width = n + 1;
  const dp = new Uint32Array((m + 1) * width);
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    }
  }

  const out: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) {
    out.push({ type: "del", text: a[i] });
    i++;
  }
  while (j < n) {
    out.push({ type: "add", text: b[j] });
    j++;
  }
  return out;
}
