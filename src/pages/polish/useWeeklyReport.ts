import { useCallback } from "react";
import {
  buildWeeklyReportPrompt,
  type PolishLevel,
  type WeeklyReportInput,
} from "./prompts";
import { useReportGeneration } from "./useReportGeneration";

/** 生成周报时所依据的输入 + 等级快照，用于判断结果是否已过期。 */
export interface WeeklySnapshot {
  input: WeeklyReportInput;
  level: PolishLevel;
}

/**
 * 周报结果过期判断（纯函数，便于单测）：比较四个内容分区与润色等级。
 * 仅切换「本周时间范围」不算过期（不影响已生成正文的事实），所以不比较 weekLabel。
 */
export function isWeeklyReportStale(
  snapshot: WeeklySnapshot | null,
  input: WeeklyReportInput,
  level: PolishLevel,
): boolean {
  if (!snapshot) return false;
  const a = snapshot.input;
  return (
    snapshot.level !== level ||
    a.progress !== input.progress ||
    a.unfinished !== input.unfinished ||
    a.nextWeekPlan !== input.nextWeekPlan ||
    a.risks !== input.risks
  );
}

/**
 * 周报生成 hook：在通用 useReportGeneration 之上，负责「周报」特有的 prompt 组装与
 * 快照定义。「生成」与「重新生成」走同一个 generate()。
 */
export function useWeeklyReport() {
  const base = useReportGeneration<WeeklySnapshot>();
  const { generate: run } = base;

  const generate = useCallback(
    (input: WeeklyReportInput, level: PolishLevel) => {
      const prompt = buildWeeklyReportPrompt(input, level);
      return run(prompt, level, { input, level });
    },
    [run],
  );

  return {
    output: base.output,
    status: base.status,
    error: base.error,
    snapshot: base.snapshot,
    pendingLevel: base.pendingLevel,
    generate,
  };
}
