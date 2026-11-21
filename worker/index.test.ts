// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
import type { TrialConfig } from "./trial";

const configured: TrialConfig = {
  TRIAL_ENDPOINT: "https://upstream.example/v1/",
  TRIAL_API_KEY: "server-only-test-key",
  TRIAL_MODEL: "trial-model",
};

function environment(config: TrialConfig = {}) {
  const fetchAsset = vi.fn(async () => new Response("SPA shell"));
  return {
    env: { ASSETS: { fetch: fetchAsset }, ...config } as unknown as Env &
      TrialConfig,
    fetchAsset,
  };
}

function completion(body: unknown) {
  return new Request("https://auwe.app/api/trial/chat/completions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("Worker routing", () => {
  it.each([
    "/api",
    "/api/missing",
    "/api/trial-other",
    "/api/trial/models",
  ])("returns JSON 404 for %s instead of the SPA shell", async (path) => {
    const { env, fetchAsset } = environment();
    const response = await worker.fetch(
      new Request(`https://auwe.app${path}`, {
        headers: { "sec-fetch-mode": "navigate" },
      }),
      env,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchAsset).not.toHaveBeenCalled();
  });

  it("delegates deep frontend routes to static assets", async () => {
    const { env, fetchAsset } = environment();
    const request = new Request("https://auwe.app/tools/json");
    const response = await worker.fetch(request, env);
    expect(fetchAsset).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe("SPA shell");
  });
});

describe("migrated trial channel", () => {
  it("is unavailable without server settings", async () => {
    const { env } = environment();
    const response = await worker.fetch(
      new Request("https://auwe.app/api/trial"),
      env,
    );
    expect(response.status).toBe(503);
  });

  it.each([
    "/api/trial",
    "/api/trial/",
  ])("exposes only public provider and model information at %s", async (path) => {
    const { env } = environment(configured);
    const response = await worker.fetch(
      new Request(`https://auwe.app${path}`),
      env,
    );
    expect(await response.json()).toEqual({
      provider: "upstream.example",
      model: "trial-model",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects unsupported methods without contacting upstream", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { env } = environment(configured);
    const response = await worker.fetch(
      new Request("https://auwe.app/api/trial/chat/completions"),
      env,
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    "text",
  ])("rejects non-object JSON bodies (%j)", async (body) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { env } = environment(configured);
    const response = await worker.fetch(completion(body), env);
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const { env } = environment(configured);
    const response = await worker.fetch(
      new Request("https://auwe.app/api/trial/chat/completions", {
        method: "POST",
        body: "{broken",
      }),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("pins model and token budget while passing SSE through unbuffered", async () => {
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
        value.enqueue(encoder.encode('data: {"text":"hello"}\n\n'));
      },
    });
    const upstream = new Response(stream, {
      headers: { "content-type": "text/event-stream", "content-length": "999" },
    });
    const fetch = vi.fn(async () => upstream);
    vi.stubGlobal("fetch", fetch);
    const { env } = environment(configured);
    const response = await worker.fetch(
      completion({ model: "untrusted-model", max_tokens: 99999, stream: true }),
      env,
    );
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://upstream.example/v1/chat/completions");
    expect(init.headers).toMatchObject({
      authorization: "Bearer server-only-test-key",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "trial-model",
      max_tokens: 4096,
      stream: true,
    });
    expect(init.redirect).toBe("manual");
    expect(response.body).toBe(upstream.body);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const reader = response.body?.getReader();
    // Read the first event before upstream ends, detecting accidental buffering.
    expect(new TextDecoder().decode((await reader?.read())?.value)).toContain(
      "hello",
    );
    controller?.close();
    await reader?.cancel();
  });

  it("rejects upstream redirects without exposing the destination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://unexpected.example/" },
          }),
      ),
    );
    const { env } = environment(configured);
    const response = await worker.fetch(completion({}), env);
    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
  });

  it("preserves upstream status codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "rate limit" }, { status: 429 }),
      ),
    );
    const { env } = environment(configured);
    const response = await worker.fetch(completion({}), env);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate limit" });
  });

  it("returns a safe error when the upstream cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("server-only-test-key must not escape");
      }),
    );
    const { env } = environment(configured);
    const response = await worker.fetch(completion({}), env);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "trial upstream unavailable",
    });
  });
});
