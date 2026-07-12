import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DailyReport } from "./DailyReport";
import type { ReportType } from "./prompts";

const REPORT_TABS: { type: ReportType; label: string; enabled: boolean }[] = [
  { type: "daily", label: "日报", enabled: true },
  { type: "weekly", label: "周报", enabled: false },
  { type: "quarterly", label: "季度汇报", enabled: false },
];

export function PolishPage() {
  const [active, setActive] = useState<ReportType>("daily");

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 px-6 py-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">文风</h1>
        <p className="text-muted-foreground">
          帮你润色职场语言、把工作量量化，成为更好的职场写手。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((tab) => (
          <Button
            key={tab.type}
            type="button"
            size="sm"
            variant={tab.type === active ? "default" : "outline"}
            disabled={!tab.enabled}
            title={tab.enabled ? undefined : "即将推出"}
            onClick={() => tab.enabled && setActive(tab.type)}
          >
            {tab.label}
            {!tab.enabled && "（待实现）"}
          </Button>
        ))}
      </div>

      {active === "daily" && <DailyReport />}
    </section>
  );
}
