import { SearchIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCommandMenu } from "./commandStore";
import { TOOLS } from "./registry";

/** 工具网格首页：胖矮卡片 + 右上安静的 ⌘K 快速跳转入口。 */
export function ToolsPage() {
  const openMenu = useCommandMenu((s) => s.setOpen);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">工具</h1>
          <p className="text-muted-foreground">
            随手可用的小工具，全部在你的浏览器本地运行。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 text-muted-foreground"
          onClick={() => openMenu(true)}
        >
          <SearchIcon />
          快速跳转
          <span className="ml-0.5 inline-flex gap-0.5">
            <kbd className="inline-flex min-w-4 items-center justify-center rounded border border-b-2 bg-muted px-1 py-px font-mono text-[0.6875rem] leading-none text-faint">
              ⌘
            </kbd>
            <kbd className="inline-flex min-w-4 items-center justify-center rounded border border-b-2 bg-muted px-1 py-px font-mono text-[0.6875rem] leading-none text-faint">
              K
            </kbd>
          </span>
        </Button>
      </div>

      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(15.5rem,1fr))]">
        {TOOLS.map((tool) => (
          <Link
            key={tool.slug}
            to={`/tools/${tool.slug}`}
            className="group flex flex-col gap-1 rounded-lg border bg-card px-3 py-2.5 shadow-panel outline-none transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-secondary group-hover:text-foreground [&_svg]:size-3.5">
                <tool.Icon />
              </span>
              <span className="text-ui-sm font-semibold">{tool.name}</span>
            </div>
            <span className="line-clamp-2 text-ui-xs text-muted-foreground">
              {tool.description}
            </span>
            <span className="text-ui-xs text-faint">{tool.category}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
