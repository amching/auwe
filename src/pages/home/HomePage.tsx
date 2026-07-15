import {
  ArrowRight,
  FileText,
  KeyRound,
  PenLine,
  ScanText,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
} from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * 首页（/）：产品落地页。延续工具页的克制视觉——白面板、发丝边、灰绿强调，
 * 不做大插画/渐变营销页。结构：一句话价值 + 四个功能入口卡 + 隐私三点 + 页脚。
 * 文案与各页面的自我介绍保持一致（改功能描述时两边同步）。
 */

interface Feature {
  to: string;
  icon: ComponentType<{ className?: string }>;
  /** 与顶部导航词对应，帮助建立「卡片 ↔ 导航」的映射。 */
  nav: string;
  title: string;
  desc: string;
  points: string[];
}

const FEATURES: Feature[] = [
  {
    to: "/resume",
    icon: FileText,
    nav: "简历",
    title: "Markdown 简历",
    desc: "左手写 Markdown，右手 A4 实时分页预览，排版一直是优雅的。",
    points: [
      "原生打印导出 PDF：文字清晰、可选中、可搜索",
      "AI 润色以 Diff 审阅，接受才写回正文",
      "源文件随时导出 .md，不被工具锁定",
    ],
  },
  {
    to: "/prompt",
    icon: ScanText,
    nav: "解构",
    title: "Prompt 解构",
    desc: "把一段又长又难读的 Prompt 拆成目标、结构、约束与作用。",
    points: [
      "原文与结构双向定位，点谁都能找到谁",
      "提炼 3–5 条可迁移的设计方法",
      "生成去业务化的可复用 Prompt 骨架",
    ],
  },
  {
    to: "/polish",
    icon: PenLine,
    nav: "文风",
    title: "职场文风",
    desc: "把零散的工作记录整理成一份得体的日报，成为更好的职场写手。",
    points: [
      "朴实到浮夸五档润色强度，随手可调",
      "事实红线：只改表达，不虚构、不拔高",
      "流式生成，结果一键复制",
    ],
  },
  {
    to: "/tools",
    icon: SquareTerminal,
    nav: "工具",
    title: "常用小工具",
    desc: "时间戳转换、JSON 查看、类型定义生成，顺手的开发小件。",
    points: [
      "⌘K 命令面板快速调出任意工具",
      "JSON 容错解析 + 虚拟化树视图",
      "JSON/YAML/CSV 一键生成 TS / Go / Rust 类型",
    ],
  },
];

const PRIVACY_POINTS = [
  {
    icon: ShieldCheck,
    title: "纯客户端",
    desc: "无账号、无后端数据库。页面是静态部署的，你的内容只在浏览器里处理与保存。",
  },
  {
    icon: KeyRound,
    title: "自带 API Key",
    desc: "AI 功能直连你自己的模型端点，API Key 只存在本地 localStorage，永不上传到我们的服务器。",
  },
  {
    icon: Sparkles,
    title: "没有 Key 也能试",
    desc: "官方试用通道开箱可用：密钥保存在服务端，不进前端，共享额度先体验再决定。",
  },
];

export function HomePage() {
  return (
    <section className="mx-auto w-full max-w-5xl flex-1 px-6">
      {/* ————— Hero：一句话说清「做什么」和「凭什么」 ————— */}
      <div className="pt-14 pb-12 sm:pt-20 sm:pb-16">
        <h1 className="max-w-2xl font-heading text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
          职场里要写的，
          <br className="sm:hidden" />
          都值得一个称手的工具。
        </h1>
        <p className="mt-4 max-w-xl text-ui leading-relaxed text-muted-foreground sm:text-base">
          写一份优雅的简历、把日报润色得体、看懂一段长 Prompt。A·U·WE
          把这些做成纯客户端工具——内容与 API Key 只留在你的浏览器。
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button render={<Link to="/resume" />}>
            开始写简历
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button variant="outline" render={<Link to="/prompt" />}>
            解构一段 Prompt
          </Button>
        </div>
      </div>

      {/* ————— 功能入口：与顶部导航一一对应的四张卡 ————— */}
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Link
            key={f.to}
            to={f.to}
            className="group flex flex-col gap-3 rounded-lg border bg-card p-5 shadow-xs outline-none transition-colors duration-150 hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <f.icon className="size-4" />
              </span>
              <span className="font-heading text-base font-semibold">
                {f.title}
              </span>
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-ui-xs leading-none text-secondary-foreground">
                {f.nav}
              </span>
              <ArrowRight
                aria-hidden
                className="ml-auto size-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground"
              />
            </div>
            <p className="text-ui-sm leading-relaxed text-muted-foreground">
              {f.desc}
            </p>
            <ul className="mt-auto space-y-1">
              {f.points.map((p) => (
                <li
                  key={p}
                  className="flex gap-2 text-ui-sm leading-relaxed text-foreground/80"
                >
                  <span aria-hidden className="text-faint">
                    ·
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>

      {/* ————— 隐私：这个产品的底层卖点，值得单独一段 ————— */}
      <div className="mt-14 sm:mt-16">
        <h2 className="font-heading text-lg font-semibold">隐私是默认值</h2>
        <p className="mt-1 text-ui-sm text-muted-foreground">
          这不是一条承诺，而是架构决定的：没有能存你数据的后端。
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {PRIVACY_POINTS.map((p) => (
            <div
              key={p.title}
              className="rounded-lg border bg-card p-4 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <p.icon aria-hidden className="size-4 text-primary" />
                <h3 className="text-ui font-medium">{p.title}</h3>
              </div>
              <p className="mt-2 text-ui-sm leading-relaxed text-muted-foreground">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ————— 页脚痕迹 ————— */}
      <footer className="mt-14 mb-8 border-t pt-5 sm:mt-16">
        <p className="text-ui-xs text-faint">
          auwe · 职场AI工具站 —— 无账号 · 纯客户端 · 自带 API Key
        </p>
      </footer>
    </section>
  );
}
