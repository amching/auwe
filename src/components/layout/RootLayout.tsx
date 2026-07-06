import { NavLink, Outlet } from "react-router-dom";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "简历", end: true },
  { to: "/polish", label: "文风", end: false },
  { to: "/tools", label: "工具", end: false },
];

export function RootLayout() {
  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <span className="font-heading text-lg font-semibold">auwe</span>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <SettingsDialog />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
