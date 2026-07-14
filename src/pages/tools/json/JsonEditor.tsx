import { json, jsonParseLinter } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { linter, lintGutter } from "@codemirror/lint";
import { tags as t } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import { editorTheme } from "../cmTheme";

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
