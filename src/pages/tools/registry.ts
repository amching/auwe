import {
  BracesIcon,
  ClockIcon,
  Code2Icon,
  CompassIcon,
  type LucideIcon,
} from "lucide-react";
import { type ComponentType, lazy } from "react";
import { TimestampTool } from "./timestamp/TimestampTool";

// JSON / 类型生成工具拖着 CodeMirror（大依赖），懒加载避免拖累工具网格/命令面板首屏。
const JsonTool = lazy(() =>
  import("./json/JsonTool").then((m) => ({ default: m.JsonTool })),
);
const TypegenTool = lazy(() =>
  import("./typegen/TypegenTool").then((m) => ({ default: m.TypegenTool })),
);
// 人生设计师拖着 Markdown 渲染 + AI SDK，同样懒加载。
const LifeDesignTool = lazy(() =>
  import("./lifedesign/LifeDesignTool").then((m) => ({
    default: m.LifeDesignTool,
  })),
);

export type ToolCategory = "开发者" | "设计师" | "内容";

export interface ToolMeta {
  /** URL slug：路由 /tools/:slug */
  slug: string;
  name: string;
  category: ToolCategory;
  /** 卡片与命令面板里的一句话说明 */
  description: string;
  /** 命令面板搜索用的额外关键词（英文别名等） */
  keywords?: string[];
  Icon: LucideIcon;
  /** 专注视图里渲染的工具本体 */
  Component: ComponentType;
  /** 需要宽幅工作区的工具（如双栏编辑器）；专注视图放宽容器。 */
  wide?: boolean;
  /** 需要 AI 能力（BYOK 或试用通道）；网格/面板/专注视图显示「AI」徽记。 */
  ai?: boolean;
}

/**
 * 工具注册表——单一事实源：网格、命令面板、路由 /tools/:slug 都读它。
 * 新增一个工具 = 往这里加一条（含 Component），页面/面板/路由自动生长。
 */
export const TOOLS: ToolMeta[] = [
  {
    slug: "timestamp",
    name: "时间戳转换",
    category: "开发者",
    description: "Unix 时间戳 ⇄ 人类可读日期，秒 / 毫秒双向。",
    keywords: ["timestamp", "unix", "epoch", "时间", "日期"],
    Icon: ClockIcon,
    Component: TimestampTool,
  },
  {
    slug: "json",
    name: "JSON 格式化 / 查看",
    category: "开发者",
    description: "格式化、压缩、容错修复、树视图浏览与搜索，大文档依然流畅。",
    keywords: [
      "json",
      "format",
      "formatter",
      "minify",
      "viewer",
      "repair",
      "格式化",
      "压缩",
      "美化",
      "修复",
    ],
    Icon: BracesIcon,
    Component: JsonTool,
    wide: true,
  },
  {
    slug: "typegen",
    name: "类型定义生成",
    category: "开发者",
    description:
      "JSON / YAML / TOML / CSV 秒变 TypeScript、Go、Rust 类型定义。",
    keywords: [
      "json to typescript",
      "interface",
      "struct",
      "serde",
      "quicktype",
      "go",
      "rust",
      "yaml",
      "toml",
      "csv",
      "类型",
      "结构体",
      "转换",
    ],
    Icon: Code2Icon,
    Component: TypegenTool,
    wide: true,
  },
  {
    slug: "life-design",
    name: "人生设计师",
    category: "内容",
    description:
      "斯坦福人生设计课 AI 教练：多轮深度对话，生成你的《个人人生设计蓝图》。",
    keywords: [
      "life design",
      "人生设计",
      "奥德赛计划",
      "斯坦福",
      "职业规划",
      "教练",
      "卡兹克",
      "chat",
    ],
    Icon: CompassIcon,
    Component: LifeDesignTool,
    ai: true,
  },
];

export function getTool(slug: string | undefined): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
