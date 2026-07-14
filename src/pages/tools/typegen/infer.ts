/**
 * 类型推断引擎：任意 JS 值（JSON/YAML/TOML/CSV 解析结果）→ 语言无关的类型 IR。
 * 三个代码生成器（TS/Go/Rust）都消费这份 IR，推断规则只写一遍：
 * - 对象数组的元素合并成同一个命名类型；部分元素缺的字段 → optional
 * - 见过 null 又见过 T → nullable；只见过 null/空数组 → any
 * - 整数与浮点分开记（Go/Rust 需要 int vs float64/f64）
 * - 混合到无法归一的标量 → any
 */

export type Shape =
  | { kind: "any" | "boolean" | "integer" | "float" | "string" }
  | { kind: "array"; element: Shape; elementNullable: boolean }
  | { kind: "object"; name: string };

export interface Field {
  /** 源数据里的原始键名（emit 时各语言自行改名 + 打标签） */
  key: string;
  shape: Shape;
  /** 在部分样本里缺席（对象数组合并时发现） */
  optional: boolean;
  /** 见过 null（但也见过具体类型；只有 null 时 shape 直接是 any） */
  nullable: boolean;
}

export interface TypeDef {
  name: string;
  fields: Field[];
}

export interface Inferred {
  rootName: string;
  /** 顶层形状；非 object 时（数组/标量根）emit 端补一条类型别名 */
  root: Shape;
  /** 父先子后的定义顺序（Root 永远第一个） */
  types: TypeDef[];
}

const MISSING = Symbol("missing");

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    !(v instanceof Date)
  );
}

type ScalarKind = "any" | "boolean" | "integer" | "float" | "string";

function scalarKind(v: unknown): ScalarKind {
  switch (typeof v) {
    case "boolean":
      return "boolean";
    case "number":
      return Number.isInteger(v) ? "integer" : "float";
    case "bigint":
      return "integer";
    case "string":
      return "string";
    default:
      // TOML/YAML 的日期时间按字符串处理；其余（对象混进标量等）归 any
      return v instanceof Date ? "string" : "any";
  }
}

function mergeScalar(a: ScalarKind, b: ScalarKind): ScalarKind {
  if (a === b) return a;
  const pair = [a, b];
  if (pair.includes("integer") && pair.includes("float")) return "float";
  return "any";
}

export function pascalCase(s: string): string {
  const words = s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let out = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  if (/^\d/.test(out)) out = `N${out}`;
  return out;
}

/** 给数组元素起单数名：users → User、statuses → Status；不认识就原样。 */
function singularize(s: string): string {
  if (/ies$/i.test(s)) return s.replace(/ies$/i, "y");
  if (/(ses|xes|ches|shes)$/i.test(s)) return s.replace(/es$/i, "");
  if (/s$/i.test(s) && !/ss$/i.test(s)) return s.replace(/s$/i, "");
  return s;
}

export function inferTypes(value: unknown, rootName = "Root"): Inferred {
  const types: TypeDef[] = [];
  const used = new Set<string>();

  function claimName(hint: string): string {
    const base = pascalCase(hint) || "Type";
    let name = base;
    let i = 2;
    while (used.has(name)) name = `${base}${i++}`;
    used.add(name);
    return name;
  }

  /** 一批同路径对象合并成一个命名类型：键取并集，按首次出现排序。 */
  function inferObjects(objs: Record<string, unknown>[], hint: string): Shape {
    const name = claimName(hint);
    const def: TypeDef = { name, fields: [] };
    types.push(def); // 先注册再递归，保证父类型排在子类型前面

    const keys: string[] = [];
    for (const o of objs)
      for (const k of Object.keys(o)) if (!keys.includes(k)) keys.push(k);

    for (const key of keys) {
      const raw = objs.map((o) => (key in o ? o[key] : MISSING));
      const present = raw.filter((v) => v !== MISSING);
      const { shape, nullable } = inferValues(present, key);
      def.fields.push({
        key,
        shape,
        optional: present.length < raw.length,
        nullable,
      });
    }
    return { kind: "object", name };
  }

  /** 同一字段跨样本收集到的值 → 合并后的形状 + 是否可空。 */
  function inferValues(
    values: unknown[],
    hint: string,
  ): { shape: Shape; nullable: boolean } {
    const nonNull = values.filter((v) => v !== null && v !== undefined);
    const nullable = nonNull.length < values.length && nonNull.length > 0;
    if (nonNull.length === 0)
      return { shape: { kind: "any" }, nullable: false };

    if (nonNull.every(isPlainObject))
      return { shape: inferObjects(nonNull, hint), nullable };

    if (nonNull.every(Array.isArray)) {
      const items = (nonNull as unknown[][]).flat(1);
      const element = inferValues(items, singularize(hint));
      return {
        shape: {
          kind: "array",
          element: element.shape,
          elementNullable: element.nullable,
        },
        nullable,
      };
    }

    let kind = scalarKind(nonNull[0]);
    for (const v of nonNull.slice(1)) kind = mergeScalar(kind, scalarKind(v));
    return { shape: { kind }, nullable };
  }

  if (isPlainObject(value)) {
    const root = inferObjects([value], rootName);
    return { rootName, root, types };
  }
  // 数组/标量根：预留 rootName 给别名，元素类型叫 <Root>Item
  used.add(pascalCase(rootName) || "Root");
  const { shape: root } = inferValues([value], `${rootName}Item`);
  return { rootName: pascalCase(rootName) || "Root", root, types };
}
