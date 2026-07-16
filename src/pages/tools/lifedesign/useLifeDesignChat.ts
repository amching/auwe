import { useCallback, useEffect, useRef, useState } from "react";
import { type ChatMessage, streamChat } from "@/lib/llm/client";
import { describeLlmError } from "@/lib/llm/errors";
import { resolveLlm } from "@/lib/llm/trial";
import { type ChatTurn, useLifeDesign } from "@/stores/lifedesign";
import { KICKOFF_MESSAGE, LIFE_DESIGN_PROMPT } from "./prompt";

/**
 * 多轮对话状态机：
 * - idle       等待用户（含尚未开场）
 * - streaming  模型回复流式输出中
 * - error      最近一次请求失败（对话记录原样保留，可重试）
 */
export type ChatStatus = "idle" | "streaming" | "error";

/**
 * 「人生设计师」的请求状态机。已完成回合持久化在 stores/lifedesign；
 * 流式半截回复（draft）、status、error 是瞬态。封装：开场、发送、重试、
 * 中止（保留已生成的部分）、空内容异常。
 */
export function useLifeDesignChat() {
  const messages = useLifeDesign((s) => s.messages);
  const setMessages = useLifeDesign((s) => s.setMessages);
  const resetStore = useLifeDesign((s) => s.reset);

  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  /** 流式输出中的半截助手回复；完成后并入 messages 并清空。 */
  const [draft, setDraft] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  // 同步在途标记：setStatus 要到下次渲染才禁用按钮，其间的连点会漏进来。
  const inFlight = useRef(false);

  // 卸载时中止在途请求，避免流继续往已卸载的组件里写。
  useEffect(() => () => abortRef.current?.abort(), []);

  /** 以 history 为完整对话记录发起一轮请求；成功后把助手回复追加进去。 */
  const run = useCallback(
    async (history: ChatTurn[]) => {
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
      setStatus("streaming");
      setError(null);
      setDraft("");
      const controller = new AbortController();
      abortRef.current = controller;
      // 提示词要求模型主动开场，但接口至少需要一条 user 消息——
      // 每轮都在历史前面垫上不进记录的开场触发消息（见 prompt.ts）。
      const request: ChatMessage[] = [
        { role: "user", content: KICKOFF_MESSAGE },
        ...history,
      ];
      let acc = "";
      try {
        for await (const chunk of streamChat(
          resolved.config,
          { system: LIFE_DESIGN_PROMPT, messages: request },
          { signal: controller.signal },
        )) {
          acc += chunk;
          setDraft(acc);
        }
        // 用户主动停止：已生成的部分照常入档，别白流那些字。
        if (controller.signal.aborted) {
          if (acc.trim())
            setMessages([...history, { role: "assistant", content: acc }]);
          setStatus("idle");
          return;
        }
        // 空回复按异常处理：接口是通的，是内容出了问题（区别于 describeLlmError）。
        if (!acc.trim()) {
          setError("接口调用成功，但模型没有返回任何内容，请重试。");
          setStatus("error");
          return;
        }
        setMessages([...history, { role: "assistant", content: acc }]);
        setStatus("idle");
      } catch (err) {
        if (controller.signal.aborted) {
          // 有的实现 abort 是流静默结束，有的是抛 AbortError——两条路同样处理。
          if (acc.trim())
            setMessages([...history, { role: "assistant", content: acc }]);
          setStatus("idle");
          return;
        }
        // 失败不动 history：用户消息保留在记录里，可一键重试。
        setError(describeLlmError(err, { trial: resolved.trial }));
        setStatus("error");
      } finally {
        setDraft("");
        abortRef.current = null;
        inFlight.current = false;
      }
    },
    [setMessages],
  );

  /** 开场：对话为空时发起第一轮，让模型按提示词要求主动问好提问。 */
  const start = useCallback(() => run([]), [run]);

  /** 发送一条用户回答并请求下一轮。 */
  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || inFlight.current) return;
      const history: ChatTurn[] = [...messages, { role: "user", content }];
      setMessages(history);
      void run(history);
    },
    [messages, setMessages, run],
  );

  /** 失败后重试：用当前记录原样再请求一轮（开场失败时记录为空，同样适用）。 */
  const retry = useCallback(() => run(messages), [run, messages]);

  /** 停止当前流式输出（已生成的部分保留）。 */
  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** 清空对话重新开始。 */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    resetStore();
    setStatus("idle");
    setError(null);
    setDraft("");
  }, [resetStore]);

  return { messages, status, error, draft, start, send, retry, stop, reset };
}
