import { useCallback, useRef, useState } from "react";
import { streamCompletion } from "@/lib/llm/client";
import { describeLlmError } from "@/lib/llm/errors";
import { resolveLlm } from "@/lib/llm/trial";
import { usePromptStudio } from "@/stores/prompt";
import { parseAnalysis } from "./analysis";
import { buildDeconstructPrompt } from "./prompts";

/**
 * 解构请求状态机（与文风页 useDailyReport 同款范式）：
 * - idle       尚未分析（可能已有上一轮的持久化结果）
 * - analyzing  请求中（右侧骨架屏；已有旧结果时旧结果保留在 store 里）
 * - success    已有可展示的解构结果
 * - error      本轮失败（旧结果与用户输入都不丢）
 *
 * status/error 是本次会话的瞬态；结果本身写入 usePromptStudio（persist），
 * 切页/刷新不丢。分析中途切走页面也没关系：流式循环继续跑完，结果照常落 store，
 * 回来即可看到（status 归 idle，但 idle + 有结果同样渲染结果）。
 *
 * 铁律第 3 条：请求走 streamCompletion 流式消费；本页产物是结构化 JSON，
 * 故流式只用于传输（chunk 累加），解析完成后一次性上屏。
 * 错误分层（见 lib/llm/errors.ts）：接口层失败走 describeLlmError；
 * 接口通了但内容为空/无法解析，用「接口调用成功，但……」文案区分。
 */

export type DeconstructStatus = "idle" | "analyzing" | "success" | "error";

export function useDeconstruct() {
  const [status, setStatus] = useState<DeconstructStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // 同步在途标记：setStatus 到下次渲染才禁用按钮，其间的连点会漏进来。
  const inFlight = useRef(false);

  const analyze = useCallback(async (input: string) => {
    if (inFlight.current) return;
    const source = input; // 快照：分析期间用户可能继续编辑左侧
    if (!source.trim()) return;

    // BYOK 优先，否则回退官方试用通道（配置解析见 lib/llm/trial.ts）。
    const resolved = resolveLlm();
    if (!resolved) {
      setError(
        "还没配置 AI，且试用通道不可用。请在设置里填入 Endpoint、API Key 和 Model。",
      );
      setStatus("error");
      return;
    }

    inFlight.current = true;
    setStatus("analyzing");
    setError(null);
    let acc = "";
    try {
      const prompt = buildDeconstructPrompt(source);
      for await (const chunk of streamCompletion(resolved.config, prompt)) {
        acc += chunk;
      }
    } catch (err) {
      setError(describeLlmError(err, { trial: resolved.trial }));
      setStatus("error");
      inFlight.current = false;
      return;
    }
    inFlight.current = false;

    if (!acc.trim()) {
      setError("接口调用成功，但模型没有返回任何内容，请重新解构。");
      setStatus("error");
      return;
    }
    try {
      const analysis = parseAnalysis(acc, source);
      usePromptStudio.getState().setResult({ analysis, source });
      setStatus("success");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setError(
        `接口调用成功，但返回的解构结果无法解析（${reason}），请重新解构。`,
      );
      setStatus("error");
    }
  }, []);

  return { status, error, analyze };
}
