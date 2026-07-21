import { useCallback } from "react";
import { buildDailyReportPrompt, type PolishLevel } from "./prompts";
import { useReportGeneration } from "./useReportGeneration";

// 状态机类型现在由通用 hook 提供；此处 re-export 以保持既有 import 路径不变。
export type { ReportStatus } from "./useReportGeneration";

/** 生成结果时所依据的输入 + 等级快照，用于判断结果是否已过期。 */
export interface GenerationSnapshot {
  input: string;
  level: PolishLevel;
}

/**
 * 结果过期判断（纯函数，便于单测）：已有一次成功生成，且当前的原始输入或润色
 * 等级与生成时的快照不一致，则视为过期——旧结果仍可显示，但要标记提示重新生成。
 */
export function isReportStale(
  snapshot: GenerationSnapshot | null,
  input: string,
  level: PolishLevel,
): boolean {
  if (!snapshot) return false;
  return snapshot.input !== input || snapshot.level !== level;
}

/**
 * 日报生成 hook：在通用 useReportGeneration 之上，负责「日报」特有的 prompt 组装与
 * 快照定义。「生成」与「重新生成」走同一个 generate()。
 */
export function useDailyReport() {
  const base = useReportGeneration<GenerationSnapshot>();
  const { generate: run } = base;

  const generate = useCallback(
    (input: string, level: PolishLevel) => {
      const prompt = buildDailyReportPrompt(input, level);
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
