import { ArrowLeftIcon } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AiBadge } from "./AiBadge";
import { getTool } from "./registry";

/** 工具专注视图：返回 + 标题 + 工具本体。未知 slug 回退到网格。 */
export function ToolView() {
  const { slug } = useParams();
  const tool = getTool(slug);
  if (!tool) return <Navigate to="/tools" replace />;

  const { Icon, Component } = tool;
  return (
    <section
      className={cn(
        "mx-auto w-full px-4 py-8",
        tool.wide ? "max-w-[96rem]" : "max-w-3xl",
      )}
    >
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to="/tools" />}
        >
          <ArrowLeftIcon />
          工具
        </Button>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-foreground [&_svg]:size-3.5">
            <Icon />
          </span>
          <h1 className="font-heading text-lg font-semibold">{tool.name}</h1>
          {tool.ai && <AiBadge />}
        </div>
      </div>
      <Component />
    </section>
  );
}
