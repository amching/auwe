import { useState } from "react";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamCompletion } from "@/lib/llm/client";
import { MarkdownPreview } from "@/lib/markdown/MarkdownPreview";
import { useSettings } from "@/stores/settings";

const SYSTEM_PROMPT = `你是一位资深的职场写作教练。请润色下面这段职场文字：
- 让语言更专业、有力、简洁；
- 尽可能把模糊的描述改写成可量化的成果（数字、比例、影响范围）；
- 用 Markdown 输出：先给出「润色后」的版本，再用要点列出「修改说明」。

原文：
`;

export function PolishPage() {
  const { endpoint, apiKey, model, isConfigured } = useSettings();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function polish() {
    setLoading(true);
    setError(null);
    setOutput("");
    try {
      const stream = streamCompletion(
        { endpoint, apiKey, model },
        SYSTEM_PROMPT + input,
      );
      for await (const chunk of stream) {
        setOutput((prev) => prev + chunk);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">文风</h1>
        <p className="text-muted-foreground">
          帮你润色职场语言、把工作量量化，成为更好的职场写手。
        </p>
      </div>

      {!isConfigured() && (
        <div className="rounded-md border border-dashed p-4 text-sm">
          还没配置 AI。请先在
          <span className="mx-1">
            <SettingsDialog
              trigger={
                <Button variant="link" className="h-auto p-0">
                  设置
                </Button>
              }
            />
          </span>
          里填入 Endpoint、API Key 和 Model。
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴你想润色的职场文字…"
            className="min-h-64"
          />
          <Button
            onClick={polish}
            disabled={loading || !input.trim() || !isConfigured()}
          >
            {loading ? "润色中…" : "润色"}
          </Button>
        </div>
        <div className="min-h-64 rounded-md border p-4">
          {error ? (
            <p className="text-sm text-destructive">出错了：{error}</p>
          ) : output ? (
            <MarkdownPreview>{output}</MarkdownPreview>
          ) : (
            <p className="text-sm text-muted-foreground">
              润色结果会显示在这里。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
