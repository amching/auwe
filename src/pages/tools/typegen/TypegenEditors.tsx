import { go } from "@codemirror/lang-go";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { rust } from "@codemirror/lang-rust";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { useMemo } from "react";
import { codeHighlight, editorTheme } from "../cmTheme";
import type { TargetLang } from "./emit";
import type { InputFormat } from "./parseInput";

const base: Extension[] = [editorTheme, syntaxHighlighting(codeHighlight)];

const inputLang: Record<InputFormat, Extension[]> = {
  json: [json()],
  yaml: [yaml()],
  toml: [StreamLanguage.define(toml)],
  csv: [], // 纯文本
};

const outputLang: Record<TargetLang, () => Extension> = {
  typescript: () => javascript({ typescript: true }),
  go,
  rust,
};

/** 左侧：受控源数据编辑器，语法高亮跟随所选格式。 */
export function InputEditor({
  value,
  onChange,
  format,
}: {
  value: string;
  onChange: (v: string) => void;
  format: InputFormat;
}) {
  const extensions = useMemo(() => [...base, ...inputLang[format]], [format]);
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

/** 右侧：只读的生成代码视图。 */
export function OutputView({
  value,
  lang,
  dimmed,
}: {
  value: string;
  lang: TargetLang;
  dimmed?: boolean;
}) {
  const extensions = useMemo(() => [...base, outputLang[lang]()], [lang]);
  return (
    <CodeMirror
      value={value}
      extensions={extensions}
      theme="light"
      height="100%"
      className={dimmed ? "h-full opacity-50" : "h-full"}
      readOnly
      editable={false}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
    />
  );
}
