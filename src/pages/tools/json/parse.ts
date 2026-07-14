import { jsonrepair } from "jsonrepair";

/**
 * 两级解析：先严格 JSON.parse；失败则用 jsonrepair 容错修复
 * （注释、缺引号的键/值、缺逗号、字符串拼接、多余转义等）后重试。
 * repaired=true 表示原文非标准 JSON，树视图展示的是修复后的结果。
 */
export type ParseOutcome =
  | { ok: true; value: unknown; repaired: boolean }
  | { ok: false; error: string };

export function parseJsonLenient(text: string): ParseOutcome {
  let strictError: unknown;
  try {
    return { ok: true, value: JSON.parse(text), repaired: false };
  } catch (e) {
    strictError = e;
  }
  try {
    return { ok: true, value: JSON.parse(jsonrepair(text)), repaired: true };
  } catch {
    // 修复也救不回来时，报严格解析的原始错误（带行列号，更可定位）。
    return {
      ok: false,
      error:
        strictError instanceof Error
          ? strictError.message
          : String(strictError),
    };
  }
}
