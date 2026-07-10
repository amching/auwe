import { SettingsIcon } from "lucide-react";
import { Suspense } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
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
  return (
    <div className="flex min-h-svh flex-col">
      {/* App shell header：56px、半透明 canvas 底 + 发丝下边、三栏 grid（导航真居中）。 */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 px-6">
          {/* 左：品牌 wordmark（发丝框胶囊，回首页）+ 副标题（细竖线分隔）。
              胶囊与导航激活态反向签名：描边无填充无 rounded-md，避免读作 tab/按钮。
              尾字距用 -mr 抵消（letter-spacing 加在字符后，末字母拖空尾会光学偏左）；
              间隔号 aria-hidden，可访问名保持 auwe。 */}
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              aria-label="auwe — 回到首页"
              className="inline-flex h-6 shrink-0 items-center rounded-full border border-border-strong px-2.5 font-heading text-ui-sm font-[550] leading-none tracking-[0.08em] text-foreground outline-none transition-colors hover:border-foreground/25 active:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="-mr-[0.08em]">
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

          {/* 中：主导航（segmented；激活态 = subtle 填充 + radius，非普通按钮） */}
          <nav className="flex items-center gap-0.5 justify-self-center">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-2.5 py-1.5 text-ui-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* 右：设置（安静的齿轮 icon button，不再是孤立的描边按钮） */}
          <div className="flex items-center gap-1 justify-self-end">
            <SettingsDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="设置"
                  className="text-muted-foreground"
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
