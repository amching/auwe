import { useCallback, useRef, useState } from "react";
import { streamCompletion } from "@/lib/llm/client";
import { useSettings } from "@/stores/settings";
import { buildDailyReportPrompt, type PolishLevel } from "./prompts";

/** 生成结果时所依据的输入 + 等级快照，用于判断结果是否已过期。 */
export interface GenerationSnapshot {
  input: string;
  level: PolishLevel;
}

/**
 * 生成状态机（显式，而非一个模糊的 boolean）：
 * - idle          尚未生成
 * - generating    首次生成（还没有旧结果，展示骨架屏）
 * - regenerating  已有旧结果时重新生成（保留旧结果 + 生成中层）
 * - success       已成功生成
 * - error         生成失败（旧结果若存在则保留）
 */
export type ReportStatus =
  | "idle"
  | "generating"
  | "regenerating"
  | "success"
  | "error";

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
 * 日报生成的请求状态机。封装：流式消费、在途去重、空内容异常、成功快照，
 * 以及「首次生成 vs 重新生成」的区分与旧结果保留。
 * 复用现有 LLM 能力（streamCompletion + settings store），「生成」与「重新生成」
 * 走同一个 generate()。
 */
export function useDailyReport() {
  const { endpoint, apiKey, model } = useSettings();
  /** 最近一次成功提交的正文；重新生成期间不清空，成功后才被替换。 */
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<ReportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GenerationSnapshot | null>(null);
  /** 当前正在生成所用的等级，用于 loading 文案（区别于用户可能已改动的选择）。 */
  const [pendingLevel, setPendingLevel] = useState<PolishLevel | null>(null);
  // 同步在途标记：setStatus 要到下次渲染才禁用按钮，其间的连点会漏进来。
  const inFlight = useRef(false);

  const generate = useCallback(
    async (input: string, level: PolishLevel) => {
      if (inFlight.current) return;
      inFlight.current = true;
      // 有旧结果 → 重新生成（保留旧结果）；否则首次生成（骨架屏）。
      const regenerating = output.trim() !== "";
      setStatus(regenerating ? "regenerating" : "generating");
      setPendingLevel(level);
      setError(null);
      try {
        const prompt = buildDailyReportPrompt(input, level);
        // 累加到本地变量，成功前不改动 output —— 首次显示骨架、重新生成保留旧文。
        let acc = "";
        for await (const chunk of streamCompletion(
          { endpoint, apiKey, model },
          prompt,
        )) {
          acc += chunk;
        }
        // LLM 返回空内容按异常处理，而不是留下一个空结果假装成功。
        if (!acc.trim()) {
          setError("模型没有返回任何内容，请重试或稍微补充一下输入。");
          setStatus("error");
          return;
        }
        setOutput(acc);
        setSnapshot({ input, level });
        setStatus("success");
      } catch (err) {
        // 失败不清空 output：重新生成失败时旧结果原样保留。
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      } finally {
        inFlight.current = false;
        setPendingLevel(null);
      }
    },
    [endpoint, apiKey, model, output],
  );

  return { output, status, error, snapshot, pendingLevel, generate };
}
