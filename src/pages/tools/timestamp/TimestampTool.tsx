import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeZoneSelect } from "./TimeZoneSelect";
import {
  formatInTimeZone,
  getTimeZones,
  parseDateTime,
  readFillableTimestamp,
  timestampToMs,
  zonedDateTimeToUnixSeconds,
} from "./timezone";

const BEIJING = "Asia/Shanghai";
/** JS Date 可表示的 ±ms 上限。 */
const MAX_DATE_MS = 8.64e15;
/** 新增行的默认时区优先级（挑一个未占用的）。 */
const ADD_PREFERENCE = [
  "Asia/Tokyo",
  "America/New_York",
  "Europe/London",
  "America/Los_Angeles",
  "Europe/Paris",
  "UTC",
];

let rowSeq = 0;

function CopyButton({
  value,
  ariaLabel,
}: {
  value: string;
  ariaLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={ariaLabel}
        disabled={!value}
        onClick={() => {
          navigator.clipboard
            ?.writeText(value)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
      >
        {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      </Button>
      {/* 视觉标签：常驻占位以免布局跳动；复制后即显、随后淡出（尊重 reduce-motion）。 */}
      <span
        aria-hidden="true"
        className={`text-ui-xs text-success transition-opacity motion-reduce:transition-none ${
          copied ? "opacity-100 duration-150" : "opacity-0 duration-700"
        }`}
      >
        已复制
      </span>
      {/* 供读屏播报（文本变化才触发，与视觉淡出解耦）。 */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "已复制" : ""}
      </span>
    </span>
  );
}

/** 一行时区结果：[时区(标签或选择器)] [该时区时间] [操作]。移动端自然换行。 */
function ZoneRow({
  label,
  timeText,
  action,
}: {
  label: React.ReactNode;
  timeText: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-56 shrink-0">{label}</div>
      <div className="min-w-0 flex-1 font-mono text-ui tabular-nums">
        {timeText || <span className="text-faint">—</span>}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function TimestampTool() {
  const zones = useMemo(getTimeZones, []);

  // —— 当前时间戳：每秒更新，卸载清理 ——
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(
      () => setNowSec(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  // —— 时间戳 → 日期时间 ——
  const [tsInput, setTsInput] = useState("");
  const forward = useMemo(() => {
    const raw = tsInput.trim();
    if (!raw) return { state: "empty" as const };
    const parsed = timestampToMs(raw);
    if (!parsed || Math.abs(parsed.ms) > MAX_DATE_MS) {
      return { state: "invalid" as const };
    }
    return { state: "ok" as const, ms: parsed.ms, unit: parsed.unit };
  }, [tsInput]);
  const forwardMs = forward.state === "ok" ? forward.ms : null;
  const offsetRef = forwardMs ?? nowSec * 1000;

  // 默认带一行，选中纽约（金融时区，与北京形成东西对照）。id=0 为该默认行，
  // 后续新增行用 rowSeq(从 1 起) 递增，避免与默认行冲突。
  const [extraRows, setExtraRows] = useState<{ id: number; zone: string }[]>(
    () => [{ id: 0, zone: "America/New_York" }],
  );

  function addRow() {
    const used = new Set([BEIJING, ...extraRows.map((r) => r.zone)]);
    const pick =
      ADD_PREFERENCE.find((z) => !used.has(z)) ??
      zones.find((z) => !used.has(z)) ??
      "UTC";
    setExtraRows((rows) => [...rows, { id: ++rowSeq, zone: pick }]);
  }

  // 聚焦/点击时尝试从剪贴板填入（仅当输入为空且内容有效）；失败静默。
  async function tryClipboardAutofill() {
    if (tsInput.trim() !== "") return;
    const text = await readFillableTimestamp(navigator.clipboard);
    if (text) setTsInput((cur) => (cur.trim() === "" ? text : cur));
  }

  // —— 日期时间 → 时间戳 ——
  const [dtInput, setDtInput] = useState("");
  const [revZone, setRevZone] = useState(BEIJING);
  const reverse = useMemo(() => {
    const raw = dtInput.trim();
    if (!raw) return { state: "empty" as const };
    const parsed = parseDateTime(raw);
    if (!parsed.ok) {
      // 尚未输够完整长度时先不报错，避免边打字边红。
      return raw.length < 19
        ? { state: "typing" as const }
        : { state: "invalid" as const };
    }
    const res = zonedDateTimeToUnixSeconds(parsed.parts, revZone);
    return res.ok
      ? { state: "ok" as const, seconds: res.seconds }
      : { state: "nonexistent" as const };
  }, [dtInput, revZone]);
  const reverseRef =
    reverse.state === "ok" ? reverse.seconds * 1000 : Date.now();

  return (
    <div className="space-y-6">
      {/* 一、当前时间戳 */}
      <section>
        <div className="mb-2 text-ui-xs font-semibold text-faint">
          当前时间戳
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {nowSec}
          </span>
          <CopyButton value={String(nowSec)} ariaLabel="复制当前时间戳" />
        </div>
      </section>

      {/* 二、时间戳 → 日期时间 */}
      <section className="border-t pt-6">
        <div className="mb-3 text-ui-xs font-semibold text-faint">
          时间戳 → 日期时间
        </div>
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="ts-input">时间戳</Label>
          <div className="relative">
            <Input
              id="ts-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="输入秒级或毫秒级时间戳"
              className="pr-9 font-mono"
              value={tsInput}
              onChange={(e) => setTsInput(e.target.value)}
              onFocus={tryClipboardAutofill}
              onClick={tryClipboardAutofill}
            />
            {tsInput && (
              <button
                type="button"
                aria-label="清除时间戳"
                onClick={() => setTsInput("")}
                className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>
          <div className="min-h-4 text-ui-xs">
            {forward.state === "ok" && (
              <span className="text-faint">
                已识别为{forward.unit === "seconds" ? "秒" : "毫秒"}级时间戳
              </span>
            )}
            {forward.state === "invalid" && (
              <span className="text-destructive">请输入有效的数字时间戳</span>
            )}
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          {/* 北京时间行：始终存在、不可删，右侧为添加按钮 */}
          <ZoneRow
            label={
              <span className="flex h-8 items-center text-ui font-medium">
                北京时间
              </span>
            }
            timeText={
              forwardMs !== null ? formatInTimeZone(forwardMs, BEIJING) : ""
            }
            action={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="添加时区"
                onClick={addRow}
              >
                <PlusIcon />
              </Button>
            }
          />
          {extraRows.map((row) => (
            <ZoneRow
              key={row.id}
              label={
                <TimeZoneSelect
                  ariaLabel="选择时区"
                  value={row.zone}
                  onValueChange={(zone) =>
                    setExtraRows((rows) =>
                      rows.map((r) => (r.id === row.id ? { ...r, zone } : r)),
                    )
                  }
                  zones={zones}
                  referenceMs={offsetRef}
                />
              }
              timeText={
                forwardMs !== null ? formatInTimeZone(forwardMs, row.zone) : ""
              }
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`删除 ${row.zone}`}
                  onClick={() =>
                    setExtraRows((rows) => rows.filter((r) => r.id !== row.id))
                  }
                >
                  <Trash2Icon />
                </Button>
              }
            />
          ))}
        </div>
      </section>

      {/* 三、日期时间 → 时间戳 */}
      <section className="border-t pt-6">
        <div className="mb-3 text-ui-xs font-semibold text-faint">
          日期时间 → 时间戳
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs space-y-1.5">
            <Label htmlFor="dt-input">日期时间</Label>
            <Input
              id="dt-input"
              autoComplete="off"
              placeholder="2026-07-13 14:08:27"
              className="font-mono"
              value={dtInput}
              onChange={(e) => setDtInput(e.target.value)}
            />
          </div>
          <div className="w-56 space-y-1.5">
            <Label htmlFor="rev-zone">时区</Label>
            <TimeZoneSelect
              id="rev-zone"
              ariaLabel="选择时区"
              value={revZone}
              onValueChange={setRevZone}
              zones={zones}
              referenceMs={reverseRef}
            />
          </div>
        </div>
        <div className="mt-1.5 min-h-4 text-ui-xs">
          {reverse.state === "invalid" && (
            <span className="text-destructive">
              请输入有效的日期时间（YYYY-MM-DD HH:mm:ss）
            </span>
          )}
          {reverse.state === "nonexistent" && (
            <span className="text-destructive">
              该时间在 {revZone} 不存在（夏令时跳变）
            </span>
          )}
        </div>
        {/* 结果预览区常驻：有效时显示秒级时间戳，否则占位 —，让用户知道结果在此。 */}
        <div className="mt-2 flex items-center gap-3">
          <span className="text-ui-xs text-faint">秒级时间戳</span>
          {reverse.state === "ok" ? (
            <>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {reverse.seconds}
              </span>
              <CopyButton
                value={String(reverse.seconds)}
                ariaLabel="复制秒级时间戳"
              />
            </>
          ) : (
            <span className="font-mono text-lg font-semibold text-faint tabular-nums">
              —
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
