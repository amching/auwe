import { json, jsonParseLinter } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { linter, lintGutter } from "@codemirror/lint";
import { tags as t } from "@lezer/highlight";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";

// 编辑器表面：跟随 App token 的浅色主题；gutter 收灰、错误下划线走 destructive。
const editorTheme = EditorView.theme({
  "&": {
    fontSize: "13px",
    backgroundColor: "transparent",
    color: "color-mix(in oklch, var(--foreground) 86%, var(--background))",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    lineHeight: "1.6",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    paddingBottom: "4rem", // 给底部浮动工具条留出滚动余量
  },
  ".cm-content": { caretColor: "var(--primary)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--primary)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "color-mix(in oklch, var(--primary) 16%, transparent)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text-muted)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  ".cm-foldGutter .cm-gutterElement": { cursor: "pointer" },
  // lint：错误波浪线 + gutter 红点收敛成主题色
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--destructive) 1px",
    textUnderlineOffset: "3px",
  },
  ".cm-lint-marker-error": {
    content: "none",
    background: "var(--destructive)",
    borderRadius: "9999px",
    width: "0.5em",
    height: "0.5em",
    margin: "auto",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    boxShadow: "var(--shadow-command)",
    padding: "2px 6px",
    fontSize: "12px",
  },
});

// JSON 语法配色：键名走墨色、字符串/数字/布尔用去饱和状态色，与树视图右侧保持同一语言。
const jsonHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: "var(--foreground)" },
  { tag: t.string, color: "var(--success)" },
  { tag: t.number, color: "var(--info)" },
  { tag: t.bool, color: "var(--warning)" },
  { tag: t.null, color: "var(--text-muted)" },
  {
    tag: [t.punctuation, t.brace, t.bracket, t.separator],
    color: "var(--muted-foreground)",
  },
]);

const extensions = [
  json(),
  linter(jsonParseLinter(), { delay: 250 }),
  lintGutter(),
  editorTheme,
  syntaxHighlighting(jsonHighlight),
];

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/** 受控的 CodeMirror JSON 编辑器：行号 + 折叠 + 实时语法校验。 */
export function JsonEditor({ value, onChange }: JsonEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="light"
      height="100%"
      className="h-full"
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: false,
        highlightActiveLineGutter: true,
      }}
    />
  );
}
