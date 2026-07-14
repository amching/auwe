/**
 * 基于 Markdown 结构的范围识别（纯函数）：
 * - describeScope：把选区起点翻译成「工作经历 / 某某科技 / 第 2 条」式面包屑
 * - paragraphRangeAt / sectionRangeAt：无选区入口（当前段落 / 当前章节）的取范围
 * 简历遵循「约定优于语法」（## 章节、### 条目、- 列表），这里按同一约定解析。
 */

export interface TextRange {
  from: number;
  to: number;
}

interface Line {
  from: number;
  to: number;
  text: string;
}

function splitLines(doc: string): Line[] {
  const lines: Line[] = [];
  let from = 0;
  for (const text of doc.split("\n")) {
    lines.push({ from, to: from + text.length, text });
    from += text.length + 1;
  }
  return lines;
}

function lineIndexAt(lines: Line[], pos: number): number {
  for (let i = 0; i < lines.length; i++) {
    if (pos <= lines[i].to) return i;
  }
  return lines.length - 1;
}

const isBlank = (text: string) => text.trim() === "";
const isListItem = (text: string) => /^\s*(?:[-*+]|\d+\.)\s/.test(text);
const headingLevel = (text: string) =>
  /^(#{1,6})\s/.exec(text)?.[1].length ?? 0;

/** 条目标题（### 标题 | 时间）只取时间前的主体。 */
function entryTitle(text: string): string {
  const body = text.replace(/^#{1,6}\s+/, "");
  const bar = body.lastIndexOf("|");
  return (bar >= 0 ? body.slice(0, bar) : body).trim();
}

/**
 * 选区起点的结构面包屑。覆盖整份文档时返回「整份简历」；
 * 落在首个章节之前（姓名/联系方式区）返回「基本信息」。
 */
export function describeScope(doc: string, from: number, to: number): string {
  const trimmed = doc.trim();
  if (trimmed) {
    const start = doc.indexOf(trimmed[0]);
    if (from <= start && to >= start + trimmed.length) return "整份简历";
  }

  const lines = splitLines(doc);
  const at = lineIndexAt(lines, from);

  let section = "";
  let entry = "";
  for (let i = at; i >= 0; i--) {
    const level = headingLevel(lines[i].text);
    if (!entry && level >= 3) entry = entryTitle(lines[i].text);
    if (level === 2) {
      section = entryTitle(lines[i].text);
      break;
    }
    if (level === 1) break;
  }

  const parts: string[] = [];
  if (section) parts.push(section);
  if (entry) parts.push(entry);

  // 落在列表项上时，数出它是本段列表里的第几条。
  if (isListItem(lines[at].text)) {
    let count = 1;
    for (let i = at - 1; i >= 0; i--) {
      if (isListItem(lines[i].text)) count++;
      else if (!isBlank(lines[i].text)) break;
    }
    parts.push(`第 ${count} 条`);
  }

  return parts.length ? parts.join(" / ") : "基本信息";
}

/** 光标所在段落（空行分隔的块；光标在空行时取上方最近的块）。 */
export function paragraphRangeAt(doc: string, pos: number): TextRange | null {
  const lines = splitLines(doc);
  let at = lineIndexAt(lines, pos);
  while (at >= 0 && isBlank(lines[at].text)) at--;
  if (at < 0) return null;

  let start = at;
  while (start > 0 && !isBlank(lines[start - 1].text)) start--;
  let end = at;
  while (end < lines.length - 1 && !isBlank(lines[end + 1].text)) end++;
  return { from: lines[start].from, to: lines[end].to };
}

/** 光标所在章节（从最近的 ## 起，到下一个 ## / # 之前；首个章节前视作开头块）。 */
export function sectionRangeAt(doc: string, pos: number): TextRange | null {
  if (!doc.trim()) return null;
  const lines = splitLines(doc);
  const at = lineIndexAt(lines, pos);

  let start = 0;
  for (let i = at; i >= 0; i--) {
    if (headingLevel(lines[i].text) === 2) {
      start = i;
      break;
    }
  }

  let end = lines.length - 1;
  for (let i = at + 1; i < lines.length; i++) {
    const level = headingLevel(lines[i].text);
    if (level === 1 || level === 2) {
      end = i - 1;
      break;
    }
  }
  while (end > start && isBlank(lines[end].text)) end--;
  return { from: lines[start].from, to: lines[end].to };
}
