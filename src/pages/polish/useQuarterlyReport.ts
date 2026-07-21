import { useCallback } from "react";
import {
  buildQuarterlyReportPrompt,
  type PolishLevel,
  type QuarterlyReportInput,
} from "./prompts";
import { useReportGeneration } from "./useReportGeneration";

/** 生成季度汇报时所依据的输入 + 等级快照，用于判断结果是否已过期。 */
export interface QuarterlySnapshot {
  input: QuarterlyReportInput;
  level: PolishLevel;
}

/**
 * 季度汇报结果过期判断（纯函数，便于单测）：比较所有内容字段（含成果数组）与润色等级。
 * 仅切换季度（quarterLabel / quarterRange）不算过期。
 */
export function isQuarterlyReportStale(
  snapshot: QuarterlySnapshot | null,
  input: QuarterlyReportInput,
  level: PolishLevel,
): boolean {
  if (!snapshot) return false;
  const a = snapshot.input;
  return (
    snapshot.level !== level ||
    a.goals !== input.goals ||
    a.unfinished !== input.unfinished ||
    a.nextQuarterPriorities !== input.nextQuarterPriorities ||
    a.risks !== input.risks ||
    JSON.stringify(a.achievements) !== JSON.stringify(input.achievements)
  );
}

/**
 * 季度汇报生成 hook：在通用 useReportGeneration 之上，负责「季度汇报」特有的
 * prompt 组装与快照定义。「生成」与「重新生成」走同一个 generate()。
 */
export function useQuarterlyReport() {
  const base = useReportGeneration<QuarterlySnapshot>();
  const { generate: run } = base;

  const generate = useCallback(
    (input: QuarterlyReportInput, level: PolishLevel) => {
      const prompt = buildQuarterlyReportPrompt(input, level);
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
