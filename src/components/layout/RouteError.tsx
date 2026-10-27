import { House, RotateCw, TriangleAlert } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isChunkLoadError } from "@/lib/chunkReload";

/**
 * 路由级 errorElement：替代 React Router 默认的「Unexpected Application Error!」
 * 开发者报错页。最常见的真实原因是**部署后旧分包 404**（页面还开着旧版 index.html，
 * 点开未加载过的路由时按旧 hash 取文件）。自动重载已在 chunkReload.ts 里做过一次，
 * 走到这里说明重载也没成功（离线 / 部署本身有问题），需要让用户自己再刷一次。
 */

function errorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "未知错误";
}

export function RouteError() {
  const error = useRouteError();
  const staleChunk = isChunkLoadError(error);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
      <div className="rounded-lg border bg-card p-6 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <TriangleAlert aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-base font-semibold">
              {staleChunk ? "页面版本已过期" : "页面出了点问题"}
            </h1>
            <p className="mt-1.5 text-ui-sm leading-relaxed text-muted-foreground">
              {staleChunk
                ? "站点刚更新过，你浏览器里还是旧版本。刷新一次即可加载新版本，你本地保存的内容（简历草稿、设置）不受影响。"
                : "刷新一次通常就能恢复。如果反复出现，可能是网络或服务端的问题。"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button onClick={() => window.location.reload()} className="gap-1.5">
            <RotateCw aria-hidden className="size-4" />
            刷新页面
          </Button>
          <Button variant="outline" render={<a href="/" />} className="gap-1.5">
            <House aria-hidden className="size-4" />
            回到首页
          </Button>
        </div>

        <details className="mt-5 border-t pt-4 text-ui-xs text-faint">
          <summary className="cursor-pointer select-none outline-none hover:text-muted-foreground">
            技术细节
          </summary>
          <p className="mt-2 break-all font-mono leading-relaxed">
            {errorMessage(error)}
          </p>
        </details>
      </div>
    </section>
  );
}
