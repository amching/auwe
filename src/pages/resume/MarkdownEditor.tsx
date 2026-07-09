import { markdown } from "@codemirror/lang-markdown";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useEffect, useState } from "react";

// 编辑器主题跟随 App 亮暗（观察 <html> 的 .dark class；主题切换开关落地后即自动生效）。
function useIsDark() {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() =>
      setDark(el.classList.contains("dark")),
    );
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const extensions = [markdown(), EditorView.lineWrapping];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/** 受控的 CodeMirror Markdown 编辑器；简历专用，但本身与简历语义无耦合。 */
export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const dark = useIsDark();
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={dark ? "dark" : "light"}
      height="100%"
      className="h-full text-sm"
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
      }}
    />
  );
}
