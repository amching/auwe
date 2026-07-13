import { SettingsIcon } from "lucide-react";
import { Suspense, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function PageFallback() {
  return (
    <div className="flex flex-1 items-center justify-center text-ui text-muted-foreground">
      加载中…
    </div>
  );
}

const NAV = [
  { to: "/", label: "简历", end: true },
  { to: "/polish", label: "文风", end: false },
  { to: "/tools", label: "工具", end: false },
];

export function RootLayout() {
  // 路由级标签页标题（简历 · auwe / 文风 · auwe / 工具 · auwe）。品牌在纯文本元数据里
  // 保持本名 auwe（wordmark 的间隔号是排印形态，不进 title）。与打印导出不冲突：
  // usePrintResume 打印时暂换标题、afterprint 还原，而这里只在 pathname 变化时写入。
  const { pathname } = useLocation();
  useEffect(() => {
    const item = NAV.find((n) =>
      n.end ? pathname === n.to : pathname.startsWith(n.to),
    );
    document.title = item ? `${item.label} · auwe` : "auwe — 职场工具站";
  }, [pathname]);

  return (
    <div className="flex min-h-svh flex-col">
      {/* App shell header：半透明 canvas 底 + 发丝下边。
          布局用 grid-template-areas 做响应式降级：
          - 窄屏（< sm）两行：第一行「品牌 | 设置」，第二行「导航」通栏（可横向滚动）；
          - 宽屏（≥ sm）单行三栏「品牌 | 导航 | 设置」。
          侧轨道用 minmax(0,1fr) 允许收缩，让中间导航真正相对整个 Header 居中，
          不受左右两侧宽度影响；px 用 clamp 平滑收窄。 */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div
          className={cn(
            "grid items-center gap-x-4 gap-y-1.5 px-[clamp(1rem,4vw,1.5rem)] py-2.5",
            "grid-cols-[minmax(0,1fr)_auto] [grid-template-areas:'brand_settings'_'nav_nav']",
            "sm:h-14 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-y-0 sm:py-0 sm:[grid-template-areas:'brand_nav_settings']",
          )}
        >
          {/* 左：品牌 wordmark（发丝框胶囊，回首页）+ 副标题（细竖线分隔）。
              胶囊与导航激活态反向签名：描边无填充无 rounded-md，避免读作 tab/按钮。
              尾字距用 -mr 抵消（letter-spacing 加在字符后，末字母拖空尾会光学偏左）；
              间隔号 aria-hidden，可访问名保持 auwe。
              胶囊 shrink-0 + nowrap 保证「A·U·WE」永远完整；空间不足时副标题先 truncate。 */}
          <div className="flex min-w-0 items-center gap-3 [grid-area:brand]">
            <Link
              to="/"
              aria-label="auwe — 回到首页"
              className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border border-border-strong px-2.5 font-heading text-ui-sm font-[550] leading-none tracking-[0.08em] text-foreground outline-none transition-colors hover:border-foreground/25 active:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="mr-[-0.08em]">
                A
                <span aria-hidden className="mx-[0.04em] text-muted-foreground">
                  ·
                </span>
                U
                <span aria-hidden className="mx-[0.04em] text-muted-foreground">
                  ·
                </span>
                WE
              </span>
            </Link>
            <span
              aria-hidden
              className="h-3.5 w-px shrink-0 bg-border-strong"
            />
            {/* 副标题末字在「站」↔「栈」间缓慢交叉溶解（工具站 / 工具栈 双关）。
                动画字形对读屏隐藏，读屏念 sr-only 的完整文案（generic span 不支持 aria-label）。 */}
            <span className="truncate text-ui-xs font-medium tracking-wide text-faint">
              <span className="sr-only">职场工具站</span>
              <span aria-hidden>职场工具</span>
              <span aria-hidden className="morph-glyph">
                <span className="morph-slot">站</span>
                <span className="morph-a">站</span>
                <span className="morph-b">栈</span>
              </span>
            </span>
          </div>

          {/* 中：主导航（segmented；激活态 = subtle 填充 + radius，非普通按钮）。
              窄屏通栏，导航项相对整个 Header 居中（内层 mx-auto w-max）：
              能容纳时 auto 边距居中，超宽时边距归零、从左起可横向滚动（隐藏滚动条），
              避免「居中 + overflow」下左侧被裁且滚不到的坑；导航项 shrink-0 + nowrap 不压缩不换行。 */}
          <nav className="no-scrollbar overflow-x-auto justify-self-stretch [grid-area:nav] sm:justify-self-center">
            <div className="mx-auto flex w-max items-center gap-0.5 sm:mx-0">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-ui-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>

          {/* 右：设置（安静的齿轮 icon button，不再是孤立的描边按钮）。
              视觉 28px 不变，after:-inset-2 透明伪元素把可点击区扩到 ≥44px。 */}
          <div className="flex items-center gap-1 justify-self-end [grid-area:settings]">
            <SettingsDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="设置"
                  className="relative text-muted-foreground after:absolute after:-inset-2 after:content-['']"
                >
                  <SettingsIcon />
                </Button>
              }
            />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
