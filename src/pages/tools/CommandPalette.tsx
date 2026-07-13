import { CornerDownLeftIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCommandMenu } from "./commandStore";
import { TOOLS } from "./registry";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-4 items-center justify-center rounded border border-b-2 bg-muted px-1 py-px font-mono text-[0.6875rem] leading-none text-faint">
      {children}
    </kbd>
  );
}

/** ⌘K 命令面板：全局唤起，输入即筛，↑↓/↵/esc 操作，回车直达工具。 */
export function CommandPalette() {
  const open = useCommandMenu((s) => s.open);
  const setOpen = useCommandMenu((s) => s.setOpen);
  const toggle = useCommandMenu((s) => s.toggle);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 全局 ⌘K / Ctrl+K 唤起（挂在 ToolsLayout，仅工具路由内生效）。
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // 每次打开重置查询与高亮。
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter((t) =>
      [t.name, t.description, t.category, ...(t.keywords ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  function go(slug: string) {
    setOpen(false);
    navigate(`/tools/${slug}`);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = results[active];
      if (t) go(t.slug);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        initialFocus={inputRef}
        className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">工具命令面板</DialogTitle>
        <div className="flex items-center gap-2.5 border-b px-4 py-3">
          <SearchIcon className="size-4 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="输入工具名，回车打开…"
            className="w-full bg-transparent text-ui text-foreground outline-none placeholder:text-faint"
          />
        </div>

        <div className="scroll-subtle max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center text-ui-sm text-faint">
              无匹配工具
            </div>
          ) : (
            results.map((t, i) => (
              <button
                key={t.slug}
                type="button"
                onMouseMove={() => setActive(i)}
                onClick={() => go(t.slug)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left outline-none",
                  i === active ? "bg-secondary" : "hover:bg-muted",
                )}
              >
                <t.Icon
                  className={cn(
                    "size-4",
                    i === active ? "text-foreground" : "text-muted-foreground",
                  )}
                />
                <span className="text-ui font-medium">{t.name}</span>
                <span className="ml-auto text-ui-xs text-faint">
                  {t.category}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-4 border-t px-4 py-2 text-ui-xs text-faint">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> 选择
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>
              <CornerDownLeftIcon className="size-3" />
            </Kbd>{" "}
            打开
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>esc</Kbd> 关闭
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
