import { describe, expect, it } from "vitest";
import {
  detectTimestampUnit,
  formatInTimeZone,
  formatOffset,
  getTimeZoneOffsetMinutes,
  getTimeZones,
  isFillableTimestamp,
  parseDateTime,
  readFillableTimestamp,
  timestampToMs,
  zonedDateTimeToUnixSeconds,
} from "./timezone";

// 参照点：spec 示例。1783922907s ⇄ 北京时间 2026-07-13 14:08:27。
const S = 1783922907;
const MS = S * 1000;

describe("时间戳单位识别", () => {
  it("秒级：位数少、量级小", () => {
    expect(detectTimestampUnit("1783922907")).toBe("seconds");
    expect(detectTimestampUnit(" 0 ")).toBe("seconds");
  });
  it("毫秒级：量级 ≥ 1e11", () => {
    expect(detectTimestampUnit("1783922907000")).toBe("milliseconds");
    expect(detectTimestampUnit("100000000000")).toBe("milliseconds");
  });
  it("非数字返回 null", () => {
    expect(detectTimestampUnit("abc")).toBeNull();
    expect(detectTimestampUnit("12.3")).toBeNull();
    expect(detectTimestampUnit("")).toBeNull();
  });
  it("秒级与毫秒级输入转换后得到相同时刻", () => {
    const sec = timestampToMs("1783922907");
    const ms = timestampToMs("1783922907000");
    expect(sec?.ms).toBe(ms?.ms);
    expect(sec?.ms).toBe(MS);
  });
});

describe("指定时区格式化（不受机器本地时区影响）", () => {
  it("北京时间固定 YYYY-MM-DD HH:mm:ss", () => {
    expect(formatInTimeZone(MS, "Asia/Shanghai")).toBe("2026-07-13 14:08:27");
  });
  it("多时区同一时刻的不同墙上时间", () => {
    expect(formatInTimeZone(MS, "UTC")).toBe("2026-07-13 06:08:27");
    expect(formatInTimeZone(MS, "Asia/Tokyo")).toBe("2026-07-13 15:08:27");
    expect(formatInTimeZone(MS, "America/New_York")).toBe(
      "2026-07-13 02:08:27",
    );
  });
});

describe("UTC 偏移（随 DST 变化，非写死）", () => {
  it("按当前时刻计算偏移", () => {
    expect(getTimeZoneOffsetMinutes(MS, "Asia/Shanghai")).toBe(480);
    expect(formatOffset(getTimeZoneOffsetMinutes(MS, "Asia/Shanghai"))).toBe(
      "UTC+08:00",
    );
    // 纽约：7 月为夏令时 -04:00
    expect(getTimeZoneOffsetMinutes(MS, "America/New_York")).toBe(-240);
    expect(formatOffset(getTimeZoneOffsetMinutes(MS, "America/New_York"))).toBe(
      "UTC-04:00",
    );
    // 纽约：1 月为标准时 -05:00（同一时区不同季节偏移不同 → 未写死）
    const janMs = Date.UTC(2026, 0, 15, 12, 0, 0);
    expect(getTimeZoneOffsetMinutes(janMs, "America/New_York")).toBe(-300);
  });
  it("UTC 偏移为 +00:00", () => {
    expect(formatOffset(getTimeZoneOffsetMinutes(MS, "UTC"))).toBe("UTC+00:00");
  });
});

describe("日期时间字符串校验", () => {
  it("合法输入解析成功", () => {
    const r = parseDateTime("2026-07-13 14:08:27");
    expect(r.ok).toBe(true);
  });
  it("空/半截输入按格式错误处理（由调用方决定是否显示）", () => {
    expect(parseDateTime("")).toEqual({ ok: false, error: "format" });
    expect(parseDateTime("2026-07-13")).toEqual({ ok: false, error: "format" });
  });
  it("非法日期 2026-02-30", () => {
    expect(parseDateTime("2026-02-30 12:00:00")).toEqual({
      ok: false,
      error: "date",
    });
  });
  it("非法时间 2026-07-13 25:00:00", () => {
    expect(parseDateTime("2026-07-13 25:00:00")).toEqual({
      ok: false,
      error: "range",
    });
  });
  it("闰年 2 月 29 合法、平年不合法", () => {
    expect(parseDateTime("2024-02-29 00:00:00").ok).toBe(true);
    expect(parseDateTime("2026-02-29 00:00:00")).toEqual({
      ok: false,
      error: "date",
    });
  });
});

describe("反向转换：所选时区的墙上时间 → 秒级时间戳", () => {
  function toUnix(dt: string, tz: string) {
    const p = parseDateTime(dt);
    if (!p.ok) throw new Error("parse failed");
    return zonedDateTimeToUnixSeconds(p.parts, tz);
  }

  it("北京时间反推回 spec 示例秒数", () => {
    expect(toUnix("2026-07-13 14:08:27", "Asia/Shanghai")).toEqual({
      ok: true,
      seconds: S,
    });
  });
  it("正向与反向可互相还原（多时区）", () => {
    for (const tz of [
      "Asia/Shanghai",
      "UTC",
      "Asia/Tokyo",
      "America/New_York",
    ]) {
      const wall = formatInTimeZone(MS, tz);
      expect(toUnix(wall, tz)).toEqual({ ok: true, seconds: S });
    }
  });
  it("输出为整数秒（不含毫秒）", () => {
    const r = toUnix("2026-07-13 14:08:27", "Asia/Shanghai");
    expect(r.ok && Number.isInteger(r.seconds)).toBe(true);
  });
});

describe("夏令时边界", () => {
  function toUnix(dt: string, tz: string) {
    const p = parseDateTime(dt);
    if (!p.ok) throw new Error("parse failed");
    return zonedDateTimeToUnixSeconds(p.parts, tz);
  }

  it("春季跳变：不存在的当地时间被标记", () => {
    // 纽约 2026-03-08 02:00 → 03:00，02:30 不存在
    expect(toUnix("2026-03-08 02:30:00", "America/New_York")).toEqual({
      ok: false,
      error: "nonexistent",
    });
  });
  it("秋季回拨：模糊时间稳定取较早（回拨前）一刻", () => {
    // 纽约 2026-11-01 01:30 出现两次，取 EDT（较早，05:30 UTC）
    const r = toUnix("2026-11-01 01:30:00", "America/New_York");
    expect(r).toEqual({ ok: true, seconds: 1793511000 });
    // 该秒数格回 UTC 应为 05:30（EDT 一侧），而非 06:30（EST 一侧）
    expect(formatInTimeZone(1793511000 * 1000, "UTC")).toBe(
      "2026-11-01 05:30:00",
    );
  });
});

describe("精选时区列表", () => {
  const zones = getTimeZones();
  it("是精选而非完整 IANA（数量受控）", () => {
    expect(zones.length).toBeGreaterThan(30);
    expect(zones.length).toBeLessThan(80);
  });
  it("含常用开发/金融时区，且都受运行环境支持", () => {
    for (const z of [
      "UTC",
      "Asia/Shanghai",
      "Asia/Tokyo",
      "Asia/Kolkata",
      "Asia/Dubai",
      "Europe/London",
      "America/New_York",
      "Australia/Sydney",
    ]) {
      expect(zones).toContain(z);
    }
  });
  it("覆盖半/刻钟偏移", () => {
    expect(getTimeZoneOffsetMinutes(MS, "Asia/Kolkata")).toBe(330); // +05:30
    expect(getTimeZoneOffsetMinutes(MS, "Asia/Kathmandu")).toBe(345); // +05:45
  });
});

describe("剪贴板自动填充（无权限也不崩）", () => {
  it("识别可填入的时间戳字符串", () => {
    expect(isFillableTimestamp(" 1783922907 ")).toBe(true);
    expect(isFillableTimestamp("1783922907000")).toBe(true);
    expect(isFillableTimestamp("hello")).toBe(false);
    expect(isFillableTimestamp("999999999999999999")).toBe(false); // 超长
  });
  it("readText 抛错时静默返回 null", async () => {
    const clipboard = {
      readText: () => Promise.reject(new Error("NotAllowedError")),
    };
    await expect(readFillableTimestamp(clipboard)).resolves.toBeNull();
  });
  it("环境不支持 Clipboard API 时返回 null", async () => {
    await expect(readFillableTimestamp(undefined)).resolves.toBeNull();
    await expect(readFillableTimestamp(null)).resolves.toBeNull();
    await expect(readFillableTimestamp({})).resolves.toBeNull();
  });
  it("剪贴板内容有效则返回去空白后的时间戳", async () => {
    const clipboard = { readText: () => Promise.resolve("  1783922907 ") };
    await expect(readFillableTimestamp(clipboard)).resolves.toBe("1783922907");
  });
  it("剪贴板内容无效则返回 null", async () => {
    const clipboard = { readText: () => Promise.resolve("not-a-ts") };
    await expect(readFillableTimestamp(clipboard)).resolves.toBeNull();
  });
});
