import {
  Decoration,
  type DecorationSet,
  EditorView,
  type Range,
  StateEffect,
  StateField,
  WidgetType,
} from "@uiw/react-codemirror";
import type { DiffSegment } from "./diff";

/**
 * 编辑器内联 Diff 审阅：文档本身保持原文不动（铁律：接受前不改正文），
 * 删除段用划线 mark 标注，新增段用 widget 插入展示。
 */

export interface AiDiffSpec {
  /** 原文片段在文档中的起点。 */
  from: number;
  segments: DiffSegment[];
}

/** 挂载/清除 Diff 装饰（传 null 清除）。 */
export const setAiDiff = StateEffect.define<AiDiffSpec | null>();

class AddedTextWidget extends WidgetType {
  readonly text: string;
  constructor(text: string) {
    super();
    this.text = text;
  }
  eq(other: AddedTextWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-ai-add";
    span.textContent = this.text;
    return span;
  }
}

function buildDecorations(spec: AiDiffSpec, docLength: number): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  let pos = spec.from;
  for (const seg of spec.segments) {
    if (seg.type === "same") {
      pos += seg.text.length;
    } else if (seg.type === "del") {
      const end = Math.min(pos + seg.text.length, docLength);
      if (end > pos) {
        ranges.push(Decoration.mark({ class: "cm-ai-del" }).range(pos, end));
      }
      pos = end;
    } else {
      ranges.push(
        Decoration.widget({
          widget: new AddedTextWidget(seg.text),
          side: 1,
        }).range(Math.min(pos, docLength)),
      );
    }
  }
  return Decoration.set(ranges, true);
}

const aiDiffField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setAiDiff)) {
        return e.value
          ? buildDecorations(e.value, tr.newDoc.length)
          : Decoration.none;
      }
    }
    // 审阅期编辑器只读，正常到不了这里；万一文档变了，位置随之映射。
    if (tr.docChanged) return value.map(tr.changes);
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const aiDiffTheme = EditorView.baseTheme({
  ".cm-ai-del": {
    backgroundColor: "color-mix(in oklch, var(--destructive) 14%, transparent)",
    textDecoration: "line-through",
    textDecorationColor:
      "color-mix(in oklch, var(--destructive) 70%, transparent)",
    color: "color-mix(in oklch, var(--destructive) 45%, var(--foreground))",
    borderRadius: "2px",
  },
  ".cm-ai-add": {
    backgroundColor: "color-mix(in oklch, var(--success) 20%, transparent)",
    color: "color-mix(in oklch, var(--success) 60%, var(--foreground))",
    fontWeight: "500",
    borderRadius: "2px",
    whiteSpace: "pre-wrap",
  },
});

export const aiDiffExtension = [aiDiffField, aiDiffTheme];
