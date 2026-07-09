import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";

// 编辑器表面 + 留白（浅色，跟随 App token；本产品不支持暗色）。
const editorTheme = EditorView.theme({
  "&": {
    fontSize: "14px",
    backgroundColor: "transparent",
    // 正文墨色调柔：从 foreground 往画布方向退 14%，不至于太重。
    color: "color-mix(in oklch, var(--foreground) 86%, var(--background))",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    padding: "1.5rem",
    lineHeight: "1.7",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
  },
  ".cm-content": {
    padding: "0",
    maxWidth: "46rem",
    caretColor: "var(--primary)",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--primary)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "color-mix(in oklch, var(--primary) 16%, transparent)" },
});

// Linear 式冷静高亮：注释/语法标记收成 muted 灰，链接走主题色，标题/加粗只靠字重分层——不再有橙、不再有默认蓝。
const mdHighlight = HighlightStyle.define([
  { tag: t.comment, color: "var(--muted-foreground)", fontStyle: "italic" },
  {
    tag: [t.heading, t.heading1, t.heading2, t.heading3, t.heading4],
    color: "var(--foreground)",
    fontWeight: "600",
  },
  { tag: t.strong, color: "var(--foreground)", fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  {
    tag: [t.link, t.url],
    color: "var(--primary)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  { tag: t.monospace, color: "var(--muted-foreground)" },
  {
    tag: [t.processingInstruction, t.meta, t.punctuation, t.labelName, t.list],
    color: "var(--muted-foreground)",
  },
]);

const extensions = [
  markdown(),
  EditorView.lineWrapping,
  editorTheme,
  syntaxHighlighting(mdHighlight),
];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/** 受控的 CodeMirror Markdown 编辑器；简历专用，但本身与简历语义无耦合。 */
export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="light"
      height="100%"
      className="h-full"
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
      }}
    />
  );
}
