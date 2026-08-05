import { useCallback, useRef, useState } from "react";
import { streamChat } from "@/lib/llm/client";
import { describeLlmError } from "@/lib/llm/errors";
import { resolveLlm } from "@/lib/llm/trial";
import { type SpeakStyle, speakSystemPrompt } from "./prompts";
import { cleanEnglish } from "./text";

/**
 * 生成状态机（显式，而非一个模糊的 boolean）：
 * - idle        还没生成过 → 页面不显示结果区
 * - generating  生成中 → 骨架屏 + 主按钮 loading + 禁止重复提交
 * - success     已有结果
 * - error       失败（输入、表达方式、旧结果都保留）
 */
export type SpeakStatus = "idle" | "generating" | "success" | "error";

/** 一次成功生成的结果快照：英文正文 + 当时的中文原话与表达方式。 */
export interface SpeakResult {
  chinese: string;
  style: SpeakStyle;
  english: string;
}

export function useEnglishSpeak() {
  const [status, setStatus] = useState<SpeakStatus>("idle");
  const [result, setResult] = useState<SpeakResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 同步在途标记：setStatus 要到下次渲染才禁用按钮，其间的连点会漏进来。
  const inFlight = useRef(false);

  const generate = useCallback(async (chinese: string, style: SpeakStyle) => {
    const text = chinese.trim();
    if (!text || inFlight.current) return;
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
    setStatus("generating");
    setError(null);
    try {
      // 累加到本地变量，成功前不动 result —— 生成中显示骨架屏，失败则旧结果原样保留。
      // 提示词作为 instructions 下发（AI SDK v7 禁止 messages 里出现 system 角色），
      // 用户的中文只作为 user 消息，不与提示词拼接。
      let acc = "";
      for await (const chunk of streamChat(resolved.config, {
        system: speakSystemPrompt(style),
        messages: [{ role: "user", content: text }],
      })) {
        acc += chunk;
      }
      const english = cleanEnglish(acc);
      // 接口通了但没内容，按失败处理，而不是留个空卡片假装成功。
      if (!english) {
        setError("接口调用成功，但模型没有返回任何内容。");
        setStatus("error");
        return;
      }
      setResult({ chinese: text, style, english });
      setStatus("success");
    } catch (err) {
      setError(describeLlmError(err, { trial: resolved.trial }));
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, []);

  return { status, result, error, generate };
}
