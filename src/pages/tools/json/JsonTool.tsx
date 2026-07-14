import {
  BracesIcon,
  CheckIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  SearchIcon,
  Settings2Icon,
} from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Segmented } from "../Segmented";
import { JsonEditor } from "./JsonEditor";
import { JsonTree } from "./JsonTree";
import {
  buildTree,
  DEFAULT_SEARCH_SETTINGS,
  type FilterMode,
  flattenVisible,
  type JsonNode,
  makeMatcher,
  type SearchSettings,
  type StringMode,
  searchTree,
} from "./model";
import { parseJsonLenient } from "./parse";
import { SAMPLE_JSON } from "./sampleJson";

type Parsed =
  | {
      ok: true;
      value: unknown;
      tree: ReturnType<typeof buildTree>;
      /** 原文非标准 JSON，经 jsonrepair 容错修复后解析。 */
      repaired: boolean;
    }
  | { ok: false; error: string };

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

/** 搜索行为设置弹层：过滤/匹配方式 + 键/值/大小写开关。 */
function SearchSettingsPopover({
  settings,
  onChange,
}: {
  settings: SearchSettings;
  onChange: (s: SearchSettings) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="搜索设置"
            title="搜索设置"
          >
            <Settings2Icon />
          </Button>
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
            过滤方式
          </div>
          <Segmented<FilterMode>
            value={settings.filterMode}
            onChange={(filterMode) => onChange({ ...settings, filterMode })}
            options={[
              { value: "auto", label: "自动" },
              { value: "filter", label: "仅过滤" },
              { value: "highlight", label: "仅高亮" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-ui-xs font-medium text-muted-foreground">
            匹配方式
          </div>
          <Segmented<StringMode>
            value={settings.stringMode}
            onChange={(stringMode) => onChange({ ...settings, stringMode })}
            options={[
              { value: "includes", label: "包含" },
              { value: "equals", label: "全等" },
              { value: "regex", label: "正则" },
            ]}
          />
        </div>
        <div className="space-y-2.5 border-t pt-3">
          <SwitchRow
            label="匹配键名"
            checked={settings.matchKeys}
            onChange={(matchKeys) => onChange({ ...settings, matchKeys })}
          />
          <SwitchRow
            label="匹配值"
            checked={settings.matchValues}
            onChange={(matchValues) => onChange({ ...settings, matchValues })}
          />
          <SwitchRow
            label="区分大小写"
            checked={settings.caseSensitive}
            onChange={(caseSensitive) =>
              onChange({ ...settings, caseSensitive })
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function JsonTool() {
  const [doc, setDoc] = useState(SAMPLE_JSON);
  // 大文档时解析/建树放到低优先级渲染，输入不掉帧。
  const deferredDoc = useDeferredValue(doc);
  const parsed = useMemo<Parsed>(() => {
    const outcome = parseJsonLenient(deferredDoc);
    if (!outcome.ok) return outcome;
    return {
      ok: true,
      value: outcome.value,
      tree: buildTree(outcome.value),
      repaired: outcome.repaired,
    };
  }, [deferredDoc]);

  // 编辑到非法中间态时，右侧保留上一次合法结果（降透明度），不闪空。
  const [display, setDisplay] = useState<Extract<Parsed, { ok: true }> | null>(
    parsed.ok ? parsed : null,
  );
  if (parsed.ok && parsed !== display) setDisplay(parsed);

  // —— 搜索 ——
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [settings, setSettings] = useState(DEFAULT_SEARCH_SETTINGS);
  const { matcher, error: matcherError } = useMemo(
    () => makeMatcher(deferredQuery.trim(), settings),
    [deferredQuery, settings],
  );
  const search = useMemo(
    () =>
      display && matcher
        ? searchTree(display.tree.root, matcher, settings)
        : null,
    [display, matcher, settings],
  );
  const filterActive = search !== null && settings.filterMode !== "highlight";
  // 「仅过滤」不点亮命中文本；自动 = 过滤 + 高亮。
  const highlightMatcher = settings.filterMode === "filter" ? null : matcher;

  // —— 展开状态：默认只展开根；用户点选记 override；搜索时自动展开命中路径 ——
  const [allExpanded, setAllExpanded] = useState(false);
  const [overrides, setOverrides] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  const isExpanded = useCallback(
    (node: JsonNode) => {
      const o = overrides.get(node.path);
      if (o !== undefined) return o;
      if (allExpanded) return true;
      if (filterActive && search) return search.kept.has(node.path);
      return node.depth < 1;
    },
    [overrides, allExpanded, filterActive, search],
  );
  const rows = useMemo(
    () =>
      display
        ? flattenVisible(
            display.tree.root,
            isExpanded,
            filterActive ? search : null,
          )
        : [],
    [display, isExpanded, filterActive, search],
  );

  const onToggle = useCallback((node: JsonNode, expanded: boolean) => {
    setOverrides((prev) => new Map(prev).set(node.path, !expanded));
  }, []);

  function updateQuery(q: string) {
    setQuery(q);
    setOverrides(new Map()); // 新查询作废旧的手动展开/折叠
  }

  function toggleExpandAll() {
    setAllExpanded((v) => !v);
    setOverrides(new Map());
  }

  // —— 左侧动作：非标准 JSON 也能格式化/压缩（顺带完成修复）——
  function reformat(space?: number) {
    const outcome = parseJsonLenient(doc);
    if (!outcome.ok) return; // 按钮在不可解析时已禁用；竞态下静默忽略
    setDoc(`${JSON.stringify(outcome.value, null, space)}\n`);
  }

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
      ?.writeText(JSON.stringify(display.value, null, 2))
      .then(() => setCopied(true))
      .catch(() => {});
  }

  const searching = matcher !== null;

  return (
    <div className="flex h-[calc(100dvh-13.5rem)] min-h-96 flex-col overflow-hidden rounded-panel border bg-card shadow-panel md:flex-row">
      {/* 左：源码编辑 */}
      <div className="relative min-h-0 min-w-0 flex-1 basis-0 border-b md:border-r md:border-b-0">
        <JsonEditor value={doc} onChange={setDoc} />
        <div className="absolute right-3 bottom-3 z-10 flex items-center gap-0.5 rounded-full border bg-card/95 p-1 shadow-command backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            disabled={!parsed.ok}
            onClick={() => reformat(2)}
          >
            格式化
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            disabled={!parsed.ok}
            onClick={() => reformat(undefined)}
          >
            压缩
          </Button>
        </div>
      </div>

      {/* 右：树视图 */}
      <div className="relative min-h-0 min-w-0 flex-1 basis-0">
        {!parsed.ok && (
          <div className="absolute inset-x-3 top-3 z-10 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-1.5 text-ui-xs text-destructive">
            <span className="line-clamp-2">JSON 无效：{parsed.error}</span>
          </div>
        )}
        {parsed.ok && parsed.repaired && (
          <div className="absolute inset-x-3 top-3 z-10 rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-ui-xs text-warning">
            非标准 JSON，已按容错模式解析——「格式化」可修复源文档
          </div>
        )}
        {display ? (
          rows.length === 0 && searching ? (
            <div className="flex h-full items-center justify-center text-ui-sm text-faint">
              没有匹配「{deferredQuery.trim()}」的键或值
            </div>
          ) : (
            <JsonTree
              rows={rows}
              matcher={searching ? highlightMatcher : null}
              settings={settings}
              onToggle={onToggle}
              className={cn(
                !parsed.ok && "opacity-50",
                // 有横幅（无效/已修复）时给树让出顶部空间
                (!parsed.ok || parsed.repaired) && "pt-10",
              )}
            />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-faint">
            <BracesIcon className="size-6" />
            <span className="text-ui-sm">左侧输入 JSON，在此浏览与搜索</span>
          </div>
        )}

        <div className="absolute right-3 bottom-3 z-10 flex items-center gap-0.5 rounded-full border bg-card/95 p-1 pl-3 shadow-command backdrop-blur">
          <SearchIcon className="size-3.5 shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="搜索键或值…"
            aria-label="搜索键或值"
            className="w-32 bg-transparent px-1.5 font-sans text-ui-sm outline-none placeholder:text-faint sm:w-40"
          />
          <span
            className={cn(
              "shrink-0 pr-1 text-ui-xs tabular-nums",
              matcherError ? "text-destructive" : "text-faint",
            )}
          >
            {matcherError ?? (search ? `${search.count} 处` : "")}
          </span>
          <div className="h-4 w-px shrink-0 bg-border" />
          <SearchSettingsPopover settings={settings} onChange={setSettings} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label={allExpanded ? "全部折叠" : "全部展开"}
            title={allExpanded ? "全部折叠" : "全部展开"}
            disabled={!display}
            onClick={toggleExpandAll}
          >
            {allExpanded ? <ChevronsDownUpIcon /> : <ChevronsUpDownIcon />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="复制格式化后的 JSON"
            title="复制格式化后的 JSON"
            disabled={!display}
            onClick={copyOutput}
          >
            {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
          </Button>
        </div>
      </div>
    </div>
  );
}
