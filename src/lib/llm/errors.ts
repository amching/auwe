import { APICallError, RetryError } from "ai";

/**
 * 把 LLM 调用抛出的异常翻译成能指导用户行动的中文（纯函数，有单测）。
 *
 * 错误分两层，文案上必须让用户一眼分清（这是本模块存在的理由）：
 * 1. 接口层失败（HTTP 4xx/5xx、网络/CORS 不通）→ 本文件处理；
 * 2. 接口成功但内容有问题（如返回为空）→ 不会抛异常，由调用方自行提示
 *    「接口调用成功，但……」。
 */

/** 从 OpenAI 兼容错误体（{"error":{"message":…}}）里挖出上游的人话。 */
function upstreamMessage(responseBody: string | undefined): string | null {
  if (!responseBody) return null;
  try {
    const parsed: unknown = JSON.parse(responseBody);
    const obj = parsed as { error?: { message?: unknown }; message?: unknown };
    const msg = obj.error?.message ?? obj.message;
    if (typeof msg !== "string" || !msg) return null;
    return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
  } catch {
    return null;
  }
}

function describeStatus(status: number, trial: boolean): string {
  switch (status) {
    case 401:
      return trial
        ? "试用通道认证失败（HTTP 401），官方试用 Key 可能已失效。可在设置里填入自己的 API Key 继续使用。"
        : "认证失败（HTTP 401）：API Key 无效或已过期，请检查设置里的 API Key。";
    case 403:
      return trial
        ? "试用通道被拒绝访问（HTTP 403）。可在设置里填入自己的 API Key 继续使用。"
        : "没有权限（HTTP 403）：这个 API Key 无权访问该接口或模型。";
    case 404:
      return trial
        ? "试用通道接口不存在（HTTP 404），可能是服务端配置有误。"
        : "接口不存在（HTTP 404）：请检查 Endpoint 是否正确（一般以 /v1 结尾）、Model 名称是否存在。";
    case 429:
      return trial
        ? "试用额度已用尽或触发限流（HTTP 429）。可在设置里填入自己的 API Key 继续使用。"
        : "请求过于频繁或额度不足（HTTP 429），请稍后再试或检查账户余额。";
    default:
      if (status >= 500) {
        return `模型服务端异常（HTTP ${status}），对方服务暂时不可用，请稍后再试。`;
      }
      return `接口请求失败（HTTP ${status}）。`;
  }
}

/**
 * 生成面向用户的错误描述。`trial` 表示本次走的是官方试用通道——
 * 此时把「检查你的 Key/Endpoint」换成「试用通道出问题 / 建议自带 Key」。
 */
export function describeLlmError(
  err: unknown,
  opts?: { trial?: boolean },
): string {
  const trial = opts?.trial ?? false;
  // streamText 默认带重试；重试耗尽抛 RetryError，真正原因在最后一次错误里。
  const cause = RetryError.isInstance(err) ? err.lastError : err;

  if (APICallError.isInstance(cause)) {
    const status = cause.statusCode;
    const detail = upstreamMessage(cause.responseBody);
    const head =
      status === undefined ? "接口请求失败。" : describeStatus(status, trial);
    return detail ? `${head}\n服务端返回：${detail}` : head;
  }

  // fetch 在网络不通 / CORS 被拦时抛 TypeError（Safari 是 "Load failed"）。
  if (cause instanceof TypeError) {
    return trial
      ? "试用通道请求未能发出：网络异常，或试用服务未部署。"
      : "请求未能发出：网络不通，或该 Endpoint 不允许浏览器直连（CORS）。可检查网络、或确认 Endpoint 支持跨域访问。";
  }

  return cause instanceof Error ? cause.message : String(cause);
}
