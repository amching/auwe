/**
 * 试用通道代理（Cloudflare Pages Function）→ /api/trial/*
 *
 * 用途：没配 BYOK 的用户自动走这里体验 AI 功能。试用的 endpoint / API key / model
 * 全部存在 Cloudflare 后台环境变量，key 从不出现在前端代码或响应里（CLAUDE.md
 * 核心原则：前端 bundle 里绝不允许出现任何托管密钥）。
 *
 * 环境变量（Pages → Settings → Variables）：
 * - TRIAL_ENDPOINT  OpenAI 兼容 base URL，如 https://api.moonshot.cn/v1
 * - TRIAL_API_KEY   试用 key（建议单独开一个低额度、可随时轮换的 key）
 * - TRIAL_MODEL     模型 id，如 moonshot-v1-8k（服务端钉死，客户端传什么都会被覆盖）
 * - TRIAL_PROVIDER  （可选）展示用厂商名，如「Moonshot AI」；缺省用 endpoint 域名
 *
 * 路由：
 * - GET  /api/trial                  探测：返回 { provider, model }，供前端展示试用徽标
 * - POST /api/trial/chat/completions 转发给上游（SSE 流式原样透传）
 */

interface Env {
  TRIAL_ENDPOINT?: string;
  TRIAL_API_KEY?: string;
  TRIAL_MODEL?: string;
  TRIAL_PROVIDER?: string;
}

interface Ctx {
  request: Request;
  env: Env;
  params: { path?: string[] };
}

/** 单次请求的输出 token 上限：够写完简历段落/日报，防止试用额度被单次请求刷穿。 */
const MAX_TOKENS_CAP = 4096;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequest({ request, env, params }: Ctx) {
  const { TRIAL_ENDPOINT, TRIAL_API_KEY, TRIAL_MODEL, TRIAL_PROVIDER } = env;
  const configured = Boolean(TRIAL_ENDPOINT && TRIAL_API_KEY && TRIAL_MODEL);
  const sub = (params.path ?? []).join("/");

  // 探测端点：只暴露厂商与模型名，绝不暴露 key / endpoint 全貌。
  if (sub === "" && request.method === "GET") {
    if (!(configured && TRIAL_ENDPOINT)) {
      return json({ error: "trial channel not configured" }, 503);
    }
    return json({
      provider: TRIAL_PROVIDER || new URL(TRIAL_ENDPOINT).hostname,
      model: TRIAL_MODEL,
    });
  }

  // 只放行 chat/completions，其余上游接口（余额、文件等）一概不代理。
  if (sub !== "chat/completions") return json({ error: "not found" }, 404);
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  if (!(configured && TRIAL_ENDPOINT && TRIAL_API_KEY && TRIAL_MODEL)) {
    return json({ error: "trial channel not configured" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  // 模型由服务端钉死；输出上限封顶，防滥用。
  body.model = TRIAL_MODEL;
  const requested =
    typeof body.max_tokens === "number" ? body.max_tokens : MAX_TOKENS_CAP;
  body.max_tokens = Math.min(requested, MAX_TOKENS_CAP);

  const upstream = await fetch(
    `${TRIAL_ENDPOINT.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TRIAL_API_KEY}`,
      },
      body: JSON.stringify(body),
    },
  );

  // 原样流式透传（SSE）。body 未解压重排，去掉长度/编码头交给平台重算。
  const headers = new Headers(upstream.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return new Response(upstream.body, { status: upstream.status, headers });
}
