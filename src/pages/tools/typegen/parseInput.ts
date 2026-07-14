/**
 * 输入解析层：JSON / YAML / TOML / CSV 文本 → JS 值，喂给 infer.ts。
 * JSON 复用 json 工具的容错解析（jsonrepair）；CSV 手写 RFC4180 子集
 * （引号、转义引号、引号内换行/逗号），首行作表头，单元格做标量推断。
 */

import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import { parseJsonLenient } from "../json/parse";

export type InputFormat = "json" | "yaml" | "toml" | "csv";

export const INPUT_FORMATS: { value: InputFormat; label: string }[] = [
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "toml", label: "TOML" },
  { value: "csv", label: "CSV" },
];

export type InputOutcome =
  | { ok: true; value: unknown; repaired: boolean }
  | { ok: false; error: string };

export function parseInput(text: string, format: InputFormat): InputOutcome {
  if (text.trim() === "") return { ok: false, error: "输入为空" };
  try {
    switch (format) {
      case "json":
        return parseJsonLenient(text);
      case "yaml":
        return { ok: true, value: parseYaml(text), repaired: false };
      case "toml":
        return { ok: true, value: parseToml(text), repaired: false };
      case "csv":
        return { ok: true, value: parseCsv(text), repaired: false };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ———————————————————————— CSV ————————————————————————

/** RFC4180 拆行拆列：支持引号字段（内含逗号/换行/"" 转义）。 */
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const push = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    push();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell === "") {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      push();
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      pushRow();
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell !== "" || row.length > 0) pushRow();
  // 掐掉纯空行（常见于结尾多一个换行）
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

const NUMERIC = /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** 单元格标量推断：空 → null，true/false → 布尔，数字样式 → 数字，其余保字符串。 */
export function coerceCell(s: string): unknown {
  if (s === "") return null;
  const lower = s.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;
  if (lower === "null") return null;
  if (NUMERIC.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER) return n;
  }
  return s;
}

/** 首行作表头 → 对象数组。列数不齐时短行缺的列视为缺席（→ optional）。 */
export function parseCsv(text: string): Record<string, unknown>[] {
  const rows = csvRows(text);
  if (rows.length === 0) throw new Error("CSV 为空");
  if (rows.length === 1) throw new Error("CSV 只有表头，没有数据行");
  const headers = rows[0].map((h, idx) =>
    h.trim() === "" ? `col${idx + 1}` : h.trim(),
  );
  return rows.slice(1).map((cells) => {
    const record: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (idx < cells.length) record[h] = coerceCell(cells[idx]);
    });
    return record;
  });
}
