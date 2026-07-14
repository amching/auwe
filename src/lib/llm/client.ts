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

  const result = streamText({
    model: provider.chat(config.model),
    prompt,
    abortSignal: opts?.signal,
  });

  for await (const chunk of result.textStream) {
    yield chunk;
  }
}
