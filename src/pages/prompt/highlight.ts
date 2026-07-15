import {
  Decoration,
  type DecorationSet,
  EditorView,
  type Extension,
  type Range,
  StateEffect,
  StateField,
} from "@uiw/react-codemirror";

/**
 * 原文 ↔ 结构联动的编辑器侧实现：
 * - 解构成功后把各结构节点的片段范围挂成 mark 装饰（轻量底色，非荧光）；
 * - 右侧选中节点 → setActiveHighlight 强调该节点片段 + revealFragment 滚动定位；
 * - 左侧点击片段 → mousedown 命中检测回调 nodeId，由页面侧选中右侧节点。
 * 文档被继续编辑时范围随 changes 映射（结果同时会被标记为「已过期」）。
 */

export interface HighlightSpec {
  nodeId: string;
  from: number;
  to: number;
}

/** 挂载/替换全部片段高亮（传空数组清除）。 */
export const setPromptHighlights = StateEffect.define<HighlightSpec[]>();
/** 设置当前强调的结构节点（null 取消强调）。 */
export const setActiveHighlight = StateEffect.define<string | null>();

interface HighlightState {
  specs: HighlightSpec[];
  activeId: string | null;
  deco: DecorationSet;
}

function buildDeco(
  specs: HighlightSpec[],
  activeId: string | null,
  docLength: number,
): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  for (const s of specs) {
    const from = Math.min(s.from, docLength);
    const to = Math.min(s.to, docLength);
    if (to <= from) continue;
    ranges.push(
      Decoration.mark({
        class:
          s.nodeId === activeId
            ? "cm-prompt-frag cm-prompt-frag-active"
            : "cm-prompt-frag",
      }).range(from, to),
    );
  }
  return Decoration.set(ranges, true);
}

const highlightField = StateField.define<HighlightState>({
  create: () => ({ specs: [], activeId: null, deco: Decoration.none }),
  update(value, tr) {
    let { specs, activeId } = value;
    let changed = false;
    if (tr.docChanged && specs.length > 0) {
      specs = specs.map((s) => ({
        ...s,
        from: tr.changes.mapPos(s.from),
        to: tr.changes.mapPos(s.to),
      }));
      changed = true;
    }
    for (const e of tr.effects) {
      if (e.is(setPromptHighlights)) {
        specs = e.value;
        changed = true;
      } else if (e.is(setActiveHighlight)) {
        activeId = e.value;
        changed = true;
      }
    }
    if (!changed) return value;
    return {
      specs,
      activeId,
      deco: buildDeco(specs, activeId, tr.newDoc.length),
    };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

const highlightTheme = EditorView.baseTheme({
  ".cm-prompt-frag": {
    backgroundColor: "color-mix(in oklch, var(--primary) 9%, transparent)",
    borderRadius: "2px",
    cursor: "pointer",
    transition: "background-color 150ms ease",
  },
  ".cm-prompt-frag-active": {
    backgroundColor: "color-mix(in oklch, var(--primary) 24%, transparent)",
  },
});

/**
 * 组装扩展。onFragmentClick 在用户点击已识别片段时回调（不拦截默认点击，
 * 光标照常落点）；调用方须保证扩展引用稳定（useMemo + 稳定回调）。
 */
export function promptHighlightExtension(
  onFragmentClick: (nodeId: string) => void,
): Extension {
  return [
    highlightField,
    highlightTheme,
    EditorView.domEventHandlers({
      mousedown(event, view) {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null) return false;
        const { specs } = view.state.field(highlightField);
        const hit = specs.find((s) => pos >= s.from && pos <= s.to);
        if (hit) onFragmentClick(hit.nodeId);
        return false;
      },
    }),
  ];
}

/** 把某个片段滚动到编辑器视口中部（点击右侧节点/原文依据时的定位）。 */
export function revealFragment(view: EditorView, from: number): void {
  view.dispatch({
    effects: EditorView.scrollIntoView(Math.min(from, view.state.doc.length), {
      y: "center",
    }),
  });
}
