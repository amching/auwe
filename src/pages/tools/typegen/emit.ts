/**
 * 代码生成器：Inferred IR → TypeScript / Go / Rust 类型定义源码。
 * 命名规则、关键字转义、序列化标签（json tag / serde rename）都在这里处理，
 * 保证输出直接可编译。
 */

import type { Inferred, Shape } from "./infer";

export type TargetLang = "typescript" | "go" | "rust";

/** omitempty 打给哪些字段：不打 / 只打推断为可选或可空的 / 全部字段 */
export type OmitemptyMode = "none" | "optional" | "all";

export interface EmitOptions {
  go: {
    /** 字段带 `json:"…"` 标签 */
    jsonTags: boolean;
    omitempty: OmitemptyMode;
    /** optional/nullable 的标量/结构体用指针表达 */
    pointers: boolean;
  };
  rust: {
    /** 生成 serde 派生 + rename 属性 */
    serde: boolean;
  };
}

export const DEFAULT_EMIT_OPTIONS: EmitOptions = {
  go: { jsonTags: true, omitempty: "all", pointers: true },
  rust: { serde: true },
};

export function emit(
  inf: Inferred,
  lang: TargetLang,
  options: EmitOptions,
): string {
  switch (lang) {
    case "typescript":
      return emitTypeScript(inf);
    case "go":
      return emitGo(inf, options.go);
    case "rust":
      return emitRust(inf, options.rust);
  }
}

// ———————————————————————— TypeScript ————————————————————————

const TS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function tsType(shape: Shape, nullable: boolean): string {
  let t: string;
  switch (shape.kind) {
    case "any":
      return "any"; // any 已含 null，不再叠 union
    case "boolean":
      t = "boolean";
      break;
    case "integer":
    case "float":
      t = "number";
      break;
    case "string":
      t = "string";
      break;
    case "object":
      t = shape.name;
      break;
    case "array": {
      const el = tsType(shape.element, shape.elementNullable);
      t = el.includes(" ") ? `(${el})[]` : `${el}[]`;
      break;
    }
  }
  return nullable ? `${t} | null` : t;
}

export function emitTypeScript(inf: Inferred): string {
  const blocks: string[] = [];
  if (inf.root.kind !== "object")
    blocks.push(`export type ${inf.rootName} = ${tsType(inf.root, false)};`);
  for (const def of inf.types) {
    const lines = def.fields.map((f) => {
      const key = TS_IDENT.test(f.key) ? f.key : JSON.stringify(f.key);
      return `  ${key}${f.optional ? "?" : ""}: ${tsType(f.shape, f.nullable)};`;
    });
    blocks.push(
      lines.length
        ? `export interface ${def.name} {\n${lines.join("\n")}\n}`
        : `export interface ${def.name} {}`,
    );
  }
  return `${blocks.join("\n\n")}\n`;
}

// ———————————————————————— Go ————————————————————————

/** Go 社区惯例的全大写缩写（json-to-go 同款味道，只收常见的） */
const GO_INITIALISMS = new Set([
  "id",
  "ip",
  "url",
  "uri",
  "api",
  "uid",
  "uuid",
  "http",
  "https",
  "json",
  "xml",
  "sql",
  "html",
  "css",
  "tcp",
  "udp",
  "dns",
  "os",
  "cpu",
]);

export function goFieldName(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let out = words
    .map((w) => {
      const lower = w.toLowerCase();
      if (GO_INITIALISMS.has(lower)) return lower.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
  if (!out) out = "Field";
  if (/^\d/.test(out)) out = `N${out}`;
  return out;
}

function goType(shape: Shape): string {
  switch (shape.kind) {
    case "any":
      return "any";
    case "boolean":
      return "bool";
    case "integer":
      return "int";
    case "float":
      return "float64";
    case "string":
      return "string";
    case "object":
      return shape.name;
    case "array": {
      const el = goType(shape.element);
      const ptr =
        shape.elementNullable && goPointerable(shape.element) ? "*" : "";
      return `[]${ptr}${el}`;
    }
  }
}

/** slice / any 本身可为 nil，不值得再包指针 */
function goPointerable(shape: Shape): boolean {
  return shape.kind !== "array" && shape.kind !== "any";
}

export function emitGo(inf: Inferred, opts: EmitOptions["go"]): string {
  const blocks: string[] = [];
  if (inf.root.kind !== "object")
    blocks.push(`type ${inf.rootName} = ${goType(inf.root)}`);

  for (const def of inf.types) {
    if (def.fields.length === 0) {
      blocks.push(`type ${def.name} struct {}`);
      continue;
    }
    const rows = def.fields.map((f) => {
      const usePtr =
        opts.pointers && (f.optional || f.nullable) && goPointerable(f.shape);
      const type = `${usePtr ? "*" : ""}${goType(f.shape)}`;
      let tag = "";
      if (opts.jsonTags) {
        const omit =
          opts.omitempty === "all" ||
          (opts.omitempty === "optional" && (f.optional || f.nullable));
        tag = `\`json:"${f.key}${omit ? ",omitempty" : ""}"\``;
      }
      return { name: goFieldName(f.key), type, tag };
    });
    // gofmt 风格：字段名、类型、标签三列对齐
    const nameW = Math.max(...rows.map((r) => r.name.length));
    const typeW = Math.max(...rows.map((r) => r.type.length));
    const lines = rows.map((r) => {
      let line = `\t${r.name.padEnd(nameW)} ${r.type}`;
      if (r.tag)
        line = `\t${r.name.padEnd(nameW)} ${r.type.padEnd(typeW)} ${r.tag}`;
      return line.trimEnd();
    });
    blocks.push(`type ${def.name} struct {\n${lines.join("\n")}\n}`);
  }
  return `${blocks.join("\n\n")}\n`;
}

// ———————————————————————— Rust ————————————————————————

const RUST_KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "dyn",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "static",
  "struct",
  "super",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
]);

export function rustFieldName(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let out = words.map((w) => w.toLowerCase()).join("_");
  if (!out) out = "field";
  if (/^\d/.test(out)) out = `n${out}`;
  return out;
}

function rustType(shape: Shape): string {
  switch (shape.kind) {
    case "any":
      return "serde_json::Value";
    case "boolean":
      return "bool";
    case "integer":
      return "i64";
    case "float":
      return "f64";
    case "string":
      return "String";
    case "object":
      return shape.name;
    case "array": {
      const el = rustType(shape.element);
      return shape.elementNullable ? `Vec<Option<${el}>>` : `Vec<${el}>`;
    }
  }
}

export function emitRust(inf: Inferred, opts: EmitOptions["rust"]): string {
  const blocks: string[] = [];
  if (opts.serde) blocks.push("use serde::{Deserialize, Serialize};");
  if (inf.root.kind !== "object")
    blocks.push(`pub type ${inf.rootName} = ${rustType(inf.root)};`);

  const derive = opts.serde
    ? "#[derive(Debug, Clone, Serialize, Deserialize)]"
    : "#[derive(Debug, Clone)]";

  for (const def of inf.types) {
    const lines: string[] = [];
    for (const f of def.fields) {
      const snake = rustFieldName(f.key);
      const ident = RUST_KEYWORDS.has(snake) ? `r#${snake}` : snake;
      if (opts.serde && snake !== f.key)
        lines.push(`    #[serde(rename = ${JSON.stringify(f.key)})]`);
      let t = rustType(f.shape);
      if ((f.optional || f.nullable) && f.shape.kind !== "any") {
        if (opts.serde && f.optional && !f.nullable)
          lines.push(`    #[serde(skip_serializing_if = "Option::is_none")]`);
        t = `Option<${t}>`;
      }
      lines.push(`    pub ${ident}: ${t},`);
    }
    blocks.push(
      lines.length
        ? `${derive}\npub struct ${def.name} {\n${lines.join("\n")}\n}`
        : `${derive}\npub struct ${def.name} {}`,
    );
  }
  return `${blocks.join("\n\n")}\n`;
}
