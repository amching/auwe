import { parseJsonLenient } from "./parse";

/**
 * 「去除转义」：剥掉多余的转义层，还原出真正的 JSON 文档。
 *
 * 典型来源：
 * - 从日志 / 网络请求里拷出的 `{\"a\":1,\"b\":\"x\"}`（整个文档被转义过）；
 * - 接口把 JSON 当字符串返回：`"{\"a\":1}"`；
 * - 被转义了不止一层的 `{\\\"a\\\":1}`。
 *
 * 语义边界：只剥「文档之外」的多余转义。合法 JSON 内部字符串里的转义
 * （如 `{"msg":"a\nb"}`）是语法的一部分，不动。
 */

/** 最多剥几层，防止极端输入下无限循环。 */
const MAX_LAYERS = 10;

export type UnescapeOutcome =
  | {
      ok: true;
      value: unknown;
      /** 实际剥掉的转义层数；0 表示本来就是合法 JSON，无需处理。 */
      layers: number;
    }
  | { ok: false; error: string };

/**
 * 按 JSON 字符串转义规则解码一层：\\ \" \/ \b \f \n \r \t \uXXXX。
 * 非法转义（如 `\x`、残缺的 `\u12`）原样保留，不做猜测。
 */
export function decodeEscapesOnce(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = text[i + 1];
    if (next === undefined) {
      out += ch;
      break;
    }
    switch (next) {
      case '"':
        out += '"';
        i++;
        break;
      case "\\":
        out += "\\";
        i++;
        break;
      case "/":
        out += "/";
        i++;
        break;
      case "b":
        out += "\b";
        i++;
        break;
      case "f":
        out += "\f";
        i++;
        break;
      case "n":
        out += "\n";
        i++;
        break;
      case "r":
        out += "\r";
        i++;
        break;
      case "t":
        out += "\t";
        i++;
        break;
      case "u": {
        const hex = text.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(Number.parseInt(hex, 16));
          i += 5;
        } else {
          out += ch;
        }
        break;
      }
      default:
        out += ch;
    }
  }
  return out;
}

/** 解出来的字符串是否还像一段 JSON（对象 / 数组 / 带引号的字符串）。 */
function looksLikeJsonText(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  const first = t[0];
  return first === "{" || first === "[" || first === '"';
}

function tryStrict(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function unescapeJson(text: string): UnescapeOutcome {
  let current = text.trim();
  if (current === "") return { ok: false, error: "内容为空" };

  let layers = 0;
  for (let step = 0; step < MAX_LAYERS; step++) {
    const strict = tryStrict(current);
    if (strict.ok) {
      // 整份内容是一个 JSON 字符串字面量，且里面装着 JSON → 继续剥一层壳
      if (typeof strict.value === "string" && looksLikeJsonText(strict.value)) {
        current = strict.value.trim();
        layers++;
        continue;
      }
      return { ok: true, value: strict.value, layers };
    }

    // 不是合法 JSON：先去掉一层转义，看看能不能救回来
    const decoded = decodeEscapesOnce(current);
    if (decoded === current) break;
    current = decoded.trim();
    layers++;
  }

  // 收尾走容错解析（缺逗号、注释等一并修复）。
  // 只有看起来仍是 JSON 的文本才放行，避免把 `hello\nworld` 这类普通文本
  // 修复成一个字符串糊弄过去。
  if (!looksLikeJsonText(current)) {
    return {
      ok: false,
      error: "内容不是 JSON（去除转义后也找不到 JSON 结构）",
    };
  }
  const outcome = parseJsonLenient(current);
  if (!outcome.ok) {
    return {
      ok: false,
      error:
        layers > 0
          ? `去除转义后仍不是合法 JSON：${outcome.error}`
          : outcome.error,
    };
  }
  return { ok: true, value: outcome.value, layers };
}

/** 把结果统一成「格式化后的 JSON 文本」，与「格式化」按钮输出一致。 */
export function formatJsonValue(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
