import { Sparkles } from "lucide-react";
import { useState } from "react";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { Button } from "@/components/ui/button";
import { useTrialChannel } from "@/lib/llm/trial";
import { useSettings } from "@/stores/settings";
import { DailyReport } from "./DailyReport";
import type { ReportType } from "./prompts";
import { QuarterlyReport } from "./QuarterlyReport";
import { WeeklyReport } from "./WeeklyReport";

const REPORT_TABS: { type: ReportType; label: string; enabled: boolean }[] = [
  { type: "daily", label: "日报", enabled: true },
  { type: "weekly", label: "周报", enabled: true },
  { type: "quarterly", label: "季度汇报", enabled: true },
];

export function PolishPage() {
  const [active, setActive] = useState<ReportType>("daily");

  // AI 就绪探测在页面层做一次：未配置 BYOK 时探测官方试用通道。日报 / 周报共用结论，
  // 避免每个 Tab 各探测一次、各弹一条提示。
  const configured = useSettings((s) =>
    Boolean(s.endpoint && s.apiKey && s.model),
  );
  const trial = useTrialChannel(!configured);
  const llmReady = configured || trial.status === "available";

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

      {!configured && trial.status === "available" && (
        <div className="rounded-md border border-dashed p-3 text-ui-sm text-muted-foreground">
          <Sparkles aria-hidden className="mr-1 inline size-3 align-[-1px]" />
          试用模式：由官方提供的 {trial.provider ?? "官方通道"} · {trial.model}
          {" 驱动，共享额度仅供体验。也可在"}
          <span className="mx-1">
            <SettingsDialog
              trigger={
                <Button variant="link" className="h-auto p-0">
                  设置
                </Button>
              }
            />
          </span>
          里填入自己的 API Key。
        </div>
      )}
      {!configured && trial.status === "unavailable" && (
        <div className="rounded-md border border-dashed p-3 text-ui-sm text-muted-foreground">
          还没配置 AI。请先在
          <span className="mx-1">
            <SettingsDialog
              trigger={
                <Button variant="link" className="h-auto p-0">
                  设置
                </Button>
              }
            />
          </span>
          里填入 Endpoint、API Key 和 Model。
        </div>
      )}

      {/* 两个 Tab 都保持挂载、用 hidden 切换：切换汇报类型时各自「填了但未生成」的
          内容与结果都不丢失，也互不覆盖。 */}
      <div hidden={active !== "daily"}>
        <DailyReport llmReady={llmReady} />
      </div>
      <div hidden={active !== "weekly"}>
        <WeeklyReport llmReady={llmReady} />
      </div>
      <div hidden={active !== "quarterly"}>
        <QuarterlyReport llmReady={llmReady} />
      </div>
    </section>
  );
}
