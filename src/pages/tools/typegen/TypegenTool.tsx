import { CheckIcon, Code2Icon, CopyIcon, Settings2Icon } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Segmented } from "../Segmented";
import {
  ToolbarSelect,
  toolbarCellClass,
  toolbarChipClass,
} from "../ToolbarSelect";
import {
  DEFAULT_EMIT_OPTIONS,
  type EmitOptions,
  emit,
  type OmitemptyMode,
  type TargetLang,
} from "./emit";
import { inferTypes, pascalCase } from "./infer";
import { INPUT_FORMATS, type InputFormat, parseInput } from "./parseInput";
import { SAMPLE_INPUT } from "./sample";
import { InputEditor, OutputView } from "./TypegenEditors";

type Generated =
  | { ok: true; code: string; repaired: boolean }
  | { ok: false; error: string };

const LANGS: { value: TargetLang; label: string }[] = [
  { value: "typescript", label: "TypeScript" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
];

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ui-sm">{label}</span>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** 生成选项弹层：根类型名 + 当前语言的专属开关。 */
function EmitOptionsPopover({
  lang,
  rootName,
  onRootName,
  options,
  onChange,
}: {
  lang: TargetLang;
  rootName: string;
  onRootName: (v: string) => void;
  options: EmitOptions;
  onChange: (o: EmitOptions) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="类型生成设置"
            title="类型生成设置"
            className={toolbarCellClass}
          >
            <span className={cn(toolbarChipClass, "w-7 px-0")}>
              <Settings2Icon className="size-4" />
            </span>
          </button>
        }
      />
      <PopoverContent
        align="end"
        side="top"
        sideOffset={10}
        className="w-60 space-y-3.5"
      >
        <div className="space-y-1.5">
          <div className="text-ui-xs font-medium text-muted-foreground">
            根类型名
          </div>
          <Input
            value={rootName}
            onChange={(e) => onRootName(e.target.value)}
            placeholder="Root"
            aria-label="根类型名"
            className="h-8 font-mono text-ui-sm"
          />
        </div>
        {lang === "go" && (
          <div className="space-y-2.5 border-t pt-3">
            <SwitchRow
              label="json 标签"
              checked={options.go.jsonTags}
              onChange={(jsonTags) =>
                onChange({ ...options, go: { ...options.go, jsonTags } })
              }
            />
            <div className="space-y-1.5">
              <div className="text-ui-xs font-medium text-muted-foreground">
                omitempty
              </div>
              <Segmented<OmitemptyMode>
                value={options.go.omitempty}
                onChange={(omitempty) =>
                  onChange({ ...options, go: { ...options.go, omitempty } })
                }
                options={[
                  { value: "none", label: "关" },
                  { value: "optional", label: "可选字段" },
                  { value: "all", label: "全部" },
                ]}
              />
            </div>
            <SwitchRow
              label="可选字段用指针"
              checked={options.go.pointers}
              onChange={(pointers) =>
                onChange({ ...options, go: { ...options.go, pointers } })
              }
            />
          </div>
        )}
        {lang === "rust" && (
          <div className="space-y-2.5 border-t pt-3">
            <SwitchRow
              label="serde 派生"
              checked={options.rust.serde}
              onChange={(serde) => onChange({ ...options, rust: { serde } })}
            />
          </div>
        )}
        {lang === "typescript" && (
          <p className="border-t pt-3 text-ui-xs text-muted-foreground">
            可选字段用 <code className="font-mono">?</code>、可空字段并上{" "}
            <code className="font-mono">| null</code>，无需额外配置。
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function TypegenTool() {
  const [doc, setDoc] = useState(SAMPLE_INPUT);
  const [format, setFormat] = useState<InputFormat>("json");
  const [lang, setLang] = useState<TargetLang>("typescript");
  const [rootName, setRootName] = useState("Root");
  const [options, setOptions] = useState(DEFAULT_EMIT_OPTIONS);

  // 大输入时解析/推断/生成放低优先级，编辑不掉帧。
  const deferredDoc = useDeferredValue(doc);
  const generated = useMemo<Generated>(() => {
    const outcome = parseInput(deferredDoc, format);
    if (!outcome.ok) return outcome;
    try {
      const inferred = inferTypes(
        outcome.value,
        pascalCase(rootName) || "Root",
      );
      return {
        ok: true,
        code: emit(inferred, lang, options),
        repaired: outcome.repaired,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }, [deferredDoc, format, lang, rootName, options]);

  // 编辑到非法中间态时，右侧保留上一次合法结果（降透明度），不闪空。
  const [display, setDisplay] = useState<Extract<
    Generated,
    { ok: true }
  > | null>(generated.ok ? generated : null);
  if (generated.ok && generated !== display) setDisplay(generated);

  // —— 复制输出 ——
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);
  function copyOutput() {
    if (!display) return;
    navigator.clipboard
      ?.writeText(display.code)
      .then(() => setCopied(true))
      .catch(() => {});
  }

  return (
    <div className="flex h-[calc(100dvh-13.5rem)] min-h-96 flex-col overflow-hidden rounded-panel border bg-card shadow-panel md:flex-row">
      {/* 左：源数据编辑 */}
      <div className="relative min-h-0 min-w-0 flex-1 basis-0 border-b md:border-r md:border-b-0">
        <InputEditor value={doc} onChange={setDoc} format={format} />
        <div className="absolute right-3 bottom-3 z-10 flex rounded-panel border bg-card shadow-command">
          <ToolbarSelect<InputFormat>
            value={format}
            onChange={setFormat}
            options={INPUT_FORMATS}
            label="输入格式"
          />
        </div>
      </div>

      {/* 右：生成的类型定义 */}
      <div className="relative min-h-0 min-w-0 flex-1 basis-0">
        {!generated.ok && (
          <div className="absolute inset-x-3 top-3 z-10 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-1.5 text-ui-xs text-destructive">
            <span className="line-clamp-2">
              {format.toUpperCase()} 无效：{generated.error}
            </span>
          </div>
        )}
        {generated.ok && generated.repaired && (
          <div className="absolute inset-x-3 top-3 z-10 rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-ui-xs text-warning">
            非标准 JSON，已按容错模式解析后生成
          </div>
        )}
        {display ? (
          <OutputView value={display.code} lang={lang} dimmed={!generated.ok} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-faint">
            <Code2Icon className="size-6" />
            <span className="text-ui-sm">左侧输入数据，在此生成类型定义</span>
          </div>
        )}

        <div className="absolute right-3 bottom-3 z-10 flex items-stretch divide-x divide-border rounded-panel border bg-card shadow-command">
          <ToolbarSelect<TargetLang>
            value={lang}
            onChange={setLang}
            options={LANGS}
            label="目标语言"
          />
          <EmitOptionsPopover
            lang={lang}
            rootName={rootName}
            onRootName={setRootName}
            options={options}
            onChange={setOptions}
          />
          <button
            type="button"
            aria-label={copied ? "已复制" : "复制生成的代码"}
            title={copied ? "已复制" : "复制生成的代码"}
            disabled={!display}
            onClick={copyOutput}
            className={cn(
              toolbarCellClass,
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <span className={cn(toolbarChipClass, "w-7 px-0")}>
              {copied ? (
                <CheckIcon className="size-4 text-success" />
              ) : (
                <CopyIcon className="size-4" />
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
