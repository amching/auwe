/**
 * 时间戳 / 时区转换的纯逻辑层。
 *
 * 全部基于运行环境自带的 `Intl.DateTimeFormat({ timeZone })`——它是 IANA 完整、
 * 且夏令时（DST）感知的，因此无需引入任何日期库，也不手工维护偏移表。
 *
 * 关键约束：任何地方都不使用 `new Date("YYYY-MM-DD HH:mm:ss")` 解析无时区字符串
 * （那会被浏览器本地时区污染）。所有「墙上时间 ↔ 时间戳」都显式带时区。
 */

export type TimestampUnit = "seconds" | "milliseconds";

/** 秒 / 毫秒阈值：|value| < 1e11 视为秒级，否则毫秒级（约等于 5138 年的秒数分界）。 */
const SECONDS_MS_THRESHOLD = 1e11;

const pad2 = (n: number) => String(n).padStart(2, "0");

// —— 每个时区的 formatter 缓存（构造 Intl.DateTimeFormat 较贵，复用之）——
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** 把某一时刻（UTC ms）在指定时区拆成墙上时间分量。 */
function partsInTimeZone(ms: number, timeZone: string): WallClock {
  const map: Record<string, string> = {};
  for (const p of getFormatter(timeZone).formatToParts(new Date(ms))) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** 识别时间戳单位；非纯整数返回 null。 */
export function detectTimestampUnit(raw: string): TimestampUnit | null {
  const s = raw.trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) < SECONDS_MS_THRESHOLD ? "seconds" : "milliseconds";
}

/** 时间戳字符串 → { 毫秒, 单位 }；无效返回 null。不修改原始输入。 */
export function timestampToMs(
  raw: string,
): { ms: number; unit: TimestampUnit } | null {
  const unit = detectTimestampUnit(raw);
  if (!unit) return null;
  const n = Number(raw.trim());
  return { ms: unit === "seconds" ? n * 1000 : n, unit };
}

/** 把某一时刻（UTC ms）格式化为指定时区的 `YYYY-MM-DD HH:mm:ss`。 */
export function formatInTimeZone(ms: number, timeZone: string): string {
  const w = partsInTimeZone(ms, timeZone);
  return `${w.year}-${pad2(w.month)}-${pad2(w.day)} ${pad2(w.hour)}:${pad2(w.minute)}:${pad2(w.second)}`;
}

/** 指定时刻下某时区相对 UTC 的偏移（分钟，东正西负），随 DST 变化。 */
export function getTimeZoneOffsetMinutes(ms: number, timeZone: string): number {
  const w = partsInTimeZone(ms, timeZone);
  const asUtc = Date.UTC(
    w.year,
    w.month - 1,
    w.day,
    w.hour,
    w.minute,
    w.second,
  );
  return Math.round((asUtc - ms) / 60000);
}

/** 偏移分钟 → `UTC+09:00` / `UTC-04:00`。 */
export function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `UTC${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export type DateTimeError = "format" | "range" | "date";

/** 用 UTC 历法算某年某月天数（避免本地时区污染）。month 为 1-12。 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 校验并解析 `YYYY-MM-DD HH:mm:ss`：
 * - `format`：不符合格式
 * - `range`：时分秒或月越界
 * - `date`：日期不存在（如 2026-02-30）
 */
export function parseDateTime(
  raw: string,
): { ok: true; parts: WallClock } | { ok: false; error: DateTimeError } {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(
    raw.trim(),
  );
  if (!m) return { ok: false, error: "format" };
  const parts: WallClock = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: Number(m[6]),
  };
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    return { ok: false, error: "range" };
  }
  if (parts.day > daysInMonth(parts.year, parts.month)) {
    return { ok: false, error: "date" };
  }
  return { ok: true, parts };
}

export type ZonedError = "nonexistent";

/**
 * 把「某时区的墙上时间」转换为秒级 Unix 时间戳（DST 安全）。
 *
 * 做法：先按 UTC 取一个初猜时刻，用该时区在初猜点的偏移回推；跨越 DST 切换时
 * 偏移会变，再用修正点的偏移回推一次；最后把结果格回该时区校验墙上时间是否一致。
 *
 * - 春季跳变「不存在」的墙上时间：格回后与请求不符 → 返回 `nonexistent`。
 * - 秋季回拨「重复出现」的模糊时间：本算法稳定选择**较早**的那一刻
 *   （回拨前、偏移较大的一侧），与请求一致，直接返回。
 */
export function zonedDateTimeToUnixSeconds(
  parts: WallClock,
  timeZone: string,
): { ok: true; seconds: number } | { ok: false; error: ZonedError } {
  const targetUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const off1 = getTimeZoneOffsetMinutes(targetUtc, timeZone);
  let t = targetUtc - off1 * 60000;
  const off2 = getTimeZoneOffsetMinutes(t, timeZone);
  if (off2 !== off1) t = targetUtc - off2 * 60000;

  const want = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
  if (formatInTimeZone(t, timeZone) !== want) {
    return { ok: false, error: "nonexistent" };
  }
  return { ok: true, seconds: Math.floor(t / 1000) };
}

// —— 时区列表 ——

/**
 * 精选常用时区（软件开发 / 金融场景），覆盖每个 UTC 偏移（含 +05:30、+03:30、
 * +05:45 等半/刻钟偏移），每档保留最常用的一到三个，用标准 IANA 标识。
 * 刻意不返回完整的几百个 IANA 时区——绝大多数小国小城用不到，反而干扰选择。
 * 偏移不写在这里（会随夏令时变化），由 `getTimeZoneOffsetMinutes` 按当前时刻计算。
 */
export const COMMON_TIME_ZONES = [
  "UTC",
  // 美洲
  "Pacific/Pago_Pago", // -11
  "Pacific/Honolulu", // -10
  "America/Anchorage", // -09
  "America/Los_Angeles", // -08
  "America/Denver", // -07
  "America/Phoenix", // -07（不用夏令时）
  "America/Chicago", // -06
  "America/Mexico_City", // -06
  "America/New_York", // -05
  "America/Toronto", // -05
  "America/Bogota", // -05
  "America/Halifax", // -04
  "America/Santiago", // -04
  "America/Sao_Paulo", // -03（-03 代表；不再列超长的 Buenos_Aires，避免选择框显示不全）
  "America/Noronha", // -02
  "Atlantic/Azores", // -01
  // 欧洲 / 非洲
  "Europe/London", // +00
  "Europe/Paris", // +01
  "Europe/Berlin", // +01（法兰克福）
  "Africa/Lagos", // +01
  "Europe/Athens", // +02
  "Africa/Johannesburg", // +02
  "Asia/Jerusalem", // +02
  "Europe/Moscow", // +03
  "Europe/Istanbul", // +03
  "Asia/Riyadh", // +03
  // 中东 / 南亚 / 东南亚
  "Asia/Tehran", // +03:30
  "Asia/Dubai", // +04
  "Asia/Kabul", // +04:30
  "Asia/Karachi", // +05
  "Asia/Kolkata", // +05:30（印度）
  "Asia/Kathmandu", // +05:45
  "Asia/Dhaka", // +06
  "Asia/Almaty", // +06
  "Asia/Yangon", // +06:30
  "Asia/Bangkok", // +07
  "Asia/Jakarta", // +07
  "Asia/Ho_Chi_Minh", // +07
  // 东亚 / 大洋洲
  "Asia/Shanghai", // +08
  "Asia/Hong_Kong", // +08
  "Asia/Singapore", // +08
  "Asia/Tokyo", // +09
  "Asia/Seoul", // +09
  "Australia/Adelaide", // +09:30
  "Australia/Sydney", // +10
  "Australia/Brisbane", // +10（不用夏令时）
  "Pacific/Guadalcanal", // +11
  "Pacific/Auckland", // +12
  "Pacific/Fiji", // +12
  "Pacific/Tongatapu", // +13
  "Pacific/Kiritimati", // +14
];

/** 运行环境是否支持某时区（个别旧环境可能缺个别 zone，防御性过滤）。 */
function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** 供选择器使用的时区列表（精选，非完整 IANA）。 */
export function getTimeZones(): string[] {
  return COMMON_TIME_ZONES.filter(isSupportedTimeZone);
}

// —— 剪贴板自动填充（可测试的纯逻辑）——

/** 剪贴板文本是否是「可自动填入」的时间戳（限制长度，避免填入离谱串）。 */
export function isFillableTimestamp(text: string): boolean {
  const s = text.trim();
  if (!/^-?\d{1,14}$/.test(s)) return false;
  return detectTimestampUnit(s) !== null;
}

/**
 * 从一个 clipboard-like 对象读取可填入的时间戳。
 * 无权限 / 不支持 / 内容无效一律静默返回 null，绝不抛出——保证页面照常可用。
 */
export async function readFillableTimestamp(
  clipboard?: { readText?: () => Promise<string> } | null,
): Promise<string | null> {
  try {
    if (!clipboard?.readText) return null;
    const text = (await clipboard.readText()).trim();
    return isFillableTimestamp(text) ? text : null;
  } catch {
    return null;
  }
}
