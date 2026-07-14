import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { describeLlmError } from "./errors";

function apiError(statusCode: number, responseBody?: string) {
  return new APICallError({
    message: "upstream error",
    url: "https://api.example.com/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    responseBody,
  });
}

describe("describeLlmError", () => {
  it("401 指向 API Key 问题", () => {
    const msg = describeLlmError(apiError(401));
    expect(msg).toContain("401");
    expect(msg).toContain("API Key");
  });

  it("404 指向 Endpoint / Model 配置", () => {
    const msg = describeLlmError(apiError(404));
    expect(msg).toContain("404");
    expect(msg).toContain("Endpoint");
    expect(msg).toContain("Model");
  });

  it("429 提示限流或额度", () => {
    const msg = describeLlmError(apiError(429));
    expect(msg).toContain("429");
  });

  it("5xx 归为服务端异常", () => {
    const msg = describeLlmError(apiError(503));
    expect(msg).toContain("503");
    expect(msg).toContain("服务端");
  });

  it("附带上游错误体里的 message", () => {
    const msg = describeLlmError(
      apiError(404, '{"error":{"message":"model not found: gpt-5o"}}'),
    );
    expect(msg).toContain("model not found: gpt-5o");
  });

  it("上游错误体不是 JSON 时不附带、也不崩", () => {
    const msg = describeLlmError(apiError(500, "<html>Bad Gateway</html>"));
    expect(msg).toContain("500");
    expect(msg).not.toContain("html");
  });

  it("解开 RetryError 取最后一次真实错误", () => {
    const inner = apiError(429);
    const retry = new RetryError({
      message: "failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [apiError(500), inner],
    });
    expect(describeLlmError(retry)).toContain("429");
  });

  it("网络层 TypeError 解释为网络 / CORS 问题", () => {
    const msg = describeLlmError(new TypeError("Failed to fetch"));
    expect(msg).toContain("CORS");
  });

  it("trial 模式下把行动建议换成「自带 Key」而非「检查你的 Key」", () => {
    const msg = describeLlmError(apiError(429), { trial: true });
    expect(msg).toContain("试用");
    expect(msg).toContain("自己的 API Key");
  });

  it("未知错误兜底输出 message", () => {
    expect(describeLlmError(new Error("boom"))).toBe("boom");
    expect(describeLlmError("weird")).toBe("weird");
  });
});
