import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { LlmConfig } from "./types";

/**
 * Anthropic requires this header to allow direct browser (CORS) calls.
 * Harmless to send to other providers. See CLAUDE.md rule 4.
 */
function browserHeaders(endpoint: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (/anthropic|claude/i.test(endpoint)) {
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }
  return headers;
}

/**
 * Stream a completion from the user's own OpenAI-compatible endpoint (BYOK).
 * The call goes straight from the browser to their endpoint — no key ever
 * touches our servers (CLAUDE.md core principle). Returns an async iterable of
 * text chunks so callers can render tokens as they arrive (rule 3: streaming).
 *
 * CORS caveat (rule 4): browser-direct only works if the endpoint allows it.
 * Endpoints that don't are where the deferred proxy function will plug in.
 */
export async function* streamCompletion(
  config: LlmConfig,
  prompt: string,
  opts?: { signal?: AbortSignal },
): AsyncIterable<string> {
  const provider = createOpenAI({
    baseURL: config.endpoint,
    apiKey: config.apiKey,
    headers: browserHeaders(config.endpoint),
  });

  let failure: unknown;
  const result = streamText({
    model: provider.chat(config.model),
    prompt,
    abortSignal: opts?.signal,
    onError: ({ error }) => {
      failure = error;
    },
  });

  for await (const chunk of result.textStream) {
    yield chunk;
  }
  // AI SDK 把错误当成流里的一种 part，而 textStream 只挑文本 part —— 401 / 429 /
  // CORS 失败时流是「正常结束」的，不会 throw。若不在这里补抛，调用方只能看到
  // 「一个字都没收到」，describeLlmError 那套可行动文案就永远用不上。
  if (failure !== undefined) throw failure;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Multi-turn variant of {@link streamCompletion}: takes a system prompt plus
 * the message history instead of a single prompt. Same BYOK / streaming /
 * CORS story — only the request shape differs. (AI SDK v7 rejects `system`
 * roles inside `messages`; the system prompt goes via `instructions`.)
 */
export async function* streamChat(
  config: LlmConfig,
  input: { system: string; messages: ChatMessage[] },
  opts?: { signal?: AbortSignal },
): AsyncIterable<string> {
  const provider = createOpenAI({
    baseURL: config.endpoint,
    apiKey: config.apiKey,
    headers: browserHeaders(config.endpoint),
  });

  let failure: unknown;
  const result = streamText({
    model: provider.chat(config.model),
    instructions: input.system,
    messages: input.messages,
    abortSignal: opts?.signal,
    onError: ({ error }) => {
      failure = error;
    },
  });

  for await (const chunk of result.textStream) {
    yield chunk;
  }
  // 同 streamCompletion：textStream 不会因接口失败而 throw，这里补抛（见上方注释）。
  if (failure !== undefined) throw failure;
}
