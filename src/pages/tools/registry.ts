import { ClockIcon, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import { TimestampTool } from "./timestamp/TimestampTool";

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
}

/** 分类（按受众）展示顺序（网格分组/未来用）。 */
export const CATEGORIES: ToolCategory[] = ["开发者", "设计师", "内容"];

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
];

export function getTool(slug: string | undefined): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
