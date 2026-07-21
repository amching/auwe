import { useCallback, useRef, useState } from "react";
import { streamCompletion } from "@/lib/llm/client";
import { describeLlmError } from "@/lib/llm/errors";
import { resolveLlm } from "@/lib/llm/trial";
import type { PolishLevel } from "./prompts";
import { stripEmptyReportSections } from "./stripPlaceholders";

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
 * 汇报生成的通用请求状态机（与「日报 / 周报 / 季度」无关）。封装：流式消费、
 * 在途去重、空内容异常、成功快照，以及「首次生成 vs 重新生成」的区分与旧结果保留。
 *
 * 复用现有 LLM 能力（streamCompletion + resolveLlm）。调用方只需把已组装好的
 * 单段 prompt、当前润色等级、以及用于判断「过期」的快照传进来——本 hook 不关心
 * prompt 怎么拼、快照长什么样（泛型 S），因此日报和周报共用同一套生成逻辑。
 *
 * @typeParam S 结果快照类型：生成成功时记录，供页面判断结果是否已过期。
 */
export function useReportGeneration<S>() {
  /** 最近一次成功提交的正文；重新生成期间不清空，成功后才被替换。 */
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<ReportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<S | null>(null);
  /** 当前正在生成所用的等级，用于 loading 文案（区别于用户可能已改动的选择）。 */
  const [pendingLevel, setPendingLevel] = useState<PolishLevel | null>(null);
  // 同步在途标记：setStatus 要到下次渲染才禁用按钮，其间的连点会漏进来。
  const inFlight = useRef(false);

  const generate = useCallback(
    async (prompt: string, level: PolishLevel, nextSnapshot: S) => {
      if (inFlight.current) return;
      inFlight.current = true;
      // BYOK 优先，否则回退官方试用通道（配置解析见 lib/llm/trial.ts）。
      const resolved = resolveLlm();
      if (!resolved) {
        setError(
          "还没配置 AI，且试用通道不可用。请在设置里填入 Endpoint、API Key 和 Model。",
        );
        setStatus("error");
        inFlight.current = false;
        return;
      }
      // 有旧结果 → 重新生成（保留旧结果）；否则首次生成（骨架屏）。
      const regenerating = output.trim() !== "";
      setStatus(regenerating ? "regenerating" : "generating");
      setPendingLevel(level);
      setError(null);
      try {
        // 累加到本地变量，成功前不改动 output —— 首次显示骨架、重新生成保留旧文。
        let acc = "";
        for await (const chunk of streamCompletion(resolved.config, prompt)) {
          acc += chunk;
        }
        // LLM 返回空内容按异常处理，而不是留下一个空结果假装成功。
        // 文案与接口层错误（describeLlmError）区分：接口是通的，是内容出了问题。
        if (!acc.trim()) {
          setError(
            "接口调用成功，但模型没有返回任何内容，请重试或稍微补充一下输入。",
          );
          setStatus("error");
          return;
        }
        // 内容层兜底：模型偶尔无视「不要写占位」的指令，仍输出「## 风险…\n暂无」这类
        // 空壳章节——在此确定性地删掉，保证用户看到的结果里不含占位章节。
        setOutput(stripEmptyReportSections(acc));
        setSnapshot(nextSnapshot);
        setStatus("success");
      } catch (err) {
        // 失败不清空 output：重新生成失败时旧结果原样保留。
        setError(describeLlmError(err, { trial: resolved.trial }));
        setStatus("error");
      } finally {
        inFlight.current = false;
        setPendingLevel(null);
      }
    },
    [output],
  );

  return { output, status, error, snapshot, pendingLevel, generate };
}
