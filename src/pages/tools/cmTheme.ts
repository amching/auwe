import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@uiw/react-codemirror";

/**
 * 工具区共享的 CodeMirror 表面主题：跟随 App token 的浅色主题；
 * gutter 收灰、lint 错误走 destructive（无 lint 的编辑器带着也无害）。
 */
export const editorTheme = EditorView.theme({
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

/**
 * 通用代码高亮（TS/Go/Rust/YAML/TOML 共用）：
 * 与 JSON 工具同一套语言——字符串绿、数字/布尔字面量暖、类型蓝、键名墨色。
 */
export const codeHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "var(--primary)", fontWeight: "500" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--info)" },
  {
    tag: [t.propertyName, t.attributeName, t.definition(t.variableName)],
    color: "var(--foreground)",
  },
  { tag: t.string, color: "var(--success)" },
  { tag: t.number, color: "var(--info)" },
  { tag: t.bool, color: "var(--warning)" },
  { tag: t.null, color: "var(--text-muted)" },
  { tag: [t.comment, t.meta], color: "var(--text-muted)", fontStyle: "italic" },
  {
    tag: [t.punctuation, t.brace, t.bracket, t.separator, t.operator],
    color: "var(--muted-foreground)",
  },
]);
