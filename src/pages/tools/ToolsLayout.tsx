import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";

/** 工具区外壳：承载 ⌘K 命令面板 + 网格/专注视图（子路由）。 */
export function ToolsLayout() {
  return (
    <>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-ui text-muted-foreground">
            加载中…
          </div>
        }
      >
        <Outlet />
      </Suspense>
      <CommandPalette />
    </>
  );
}
