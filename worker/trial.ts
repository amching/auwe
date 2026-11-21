import { json } from "./responses";

/** Optional server-only settings. No trial channel is exposed until configured. */
export interface TrialConfig {
  TRIAL_ENDPOINT?: string;
  TRIAL_API_KEY?: string;
  TRIAL_MODEL?: string;
  TRIAL_PROVIDER?: string;
}

const MAX_TOKENS_CAP = 4096;

/** Preserve the existing /api/trial API while running it in Workers. */
export async function handleTrial(
  request: Request,
  env: TrialConfig,
  subpath: string,
): Promise<Response> {
  const { TRIAL_ENDPOINT, TRIAL_API_KEY, TRIAL_MODEL, TRIAL_PROVIDER } = env;
  if (subpath !== "" && subpath !== "chat/completions") {
    return json({ error: "not found" }, 404);
  }
  const method = subpath === "" ? "GET" : "POST";
  if (request.method !== method) {
    const response = json({ error: "method not allowed" }, 405);
    response.headers.set("allow", method);
    return response;
  }
  if (!(TRIAL_ENDPOINT && TRIAL_API_KEY && TRIAL_MODEL)) {
    return json({ error: "trial channel not configured" }, 503);
  }

  let endpoint: URL;
  try {
    endpoint = new URL(TRIAL_ENDPOINT);
    if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
      throw new Error("invalid endpoint protocol");
    }
  } catch {
    return json({ error: "trial channel not configured" }, 503);
  }

  if (subpath === "") {
    return json({
      provider: TRIAL_PROVIDER || endpoint.hostname,
      model: TRIAL_MODEL,
    });
  }

  let body: Record<string, unknown>;
  try {
    const input: unknown = await request.json();
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      return json({ error: "invalid JSON body" }, 400);
    }
    body = input as Record<string, unknown>;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  body.model = TRIAL_MODEL;
  const requested = body.max_tokens;
  body.max_tokens =
    typeof requested === "number" && Number.isFinite(requested) && requested > 0
      ? Math.max(1, Math.min(Math.floor(requested), MAX_TOKENS_CAP))
      : MAX_TOKENS_CAP;

  const upstream = await fetch(
    `${TRIAL_ENDPOINT.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TRIAL_API_KEY}`,
      },
      body: JSON.stringify(body),
      redirect: "manual",
      signal: request.signal,
    },
  );

  // Workers supports manual/follow, not redirect: "error". Never forward the
  // server credential to another destination or redirect the browser there.
  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel();
    return json({ error: "trial upstream unavailable" }, 502);
  }

  // Pass SSE through without buffering or re-encoding it.
  const headers = new Headers(upstream.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { status: upstream.status, headers });
}
