import { useEffect } from "react";
import { create } from "zustand";
import { useSettings } from "@/stores/settings";
import type { LlmConfig } from "./types";

/**
 * 官方试用通道（BYOK 的兜底）。
 *
 * 试用的 endpoint / key / model 全部配置在 Cloudflare edge function 的环境变量里
 * （见 functions/api/trial/），前端只知道同源路径 /api/trial——key 永远不会出现在
 * bundle、localStorage 或任何请求头里，DevTools 也看不到。
 *
 * 探测：GET /api/trial 返回 { provider, model } 即视为可用；本地 `pnpm dev` 没有
 * edge function（Vite 会回 404/HTML），自然降级为「不可用」，与未部署行为一致。
 */

export const TRIAL_BASE_URL = "/api/trial";

export type TrialStatus = "unknown" | "checking" | "available" | "unavailable";

interface TrialState {
  status: TrialStatus;
  /** 展示用厂商名（如「Moonshot AI」），由 edge function 下发。 */
  provider: string | null;
  /** 试用模型 id，由 edge function 下发（请求侧也会被服务端钉死）。 */
  model: string | null;
  /** 探测试用通道；幂等，只有首次调用真正发请求。 */
  ensure: () => void;
}

export const useTrial = create<TrialState>()((set, get) => ({
  status: "unknown",
  provider: null,
  model: null,
  ensure: () => {
    if (get().status !== "unknown") return;
    set({ status: "checking" });
    fetch(TRIAL_BASE_URL, { headers: { accept: "application/json" } })
      .then(async (res) => {
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !type.includes("application/json")) {
          throw new Error("trial unavailable");
        }
        const info: unknown = await res.json();
        const model =
          typeof (info as { model?: unknown }).model === "string"
            ? ((info as { model: string }).model as string)
            : null;
        if (!model) throw new Error("trial info malformed");
        const provider = (info as { provider?: unknown }).provider;
        set({
          status: "available",
          model,
          provider: typeof provider === "string" ? provider : null,
        });
      })
      .catch(() => set({ status: "unavailable" }));
  },
}));

/**
 * 组件侧接入点：未配置 BYOK 时自动探测试用通道，返回其状态与展示信息。
 * `enabled` 传 false（已配置 BYOK）则不发探测请求。
 */
export function useTrialChannel(enabled: boolean) {
  const status = useTrial((s) => s.status);
  const provider = useTrial((s) => s.provider);
  const model = useTrial((s) => s.model);
  const ensure = useTrial((s) => s.ensure);
  useEffect(() => {
    if (enabled) ensure();
  }, [enabled, ensure]);
  return { status, provider, model };
}

export interface ResolvedLlm {
  config: LlmConfig;
  /** true = 走官方试用通道（报错文案、UI 徽标据此区分）。 */
  trial: boolean;
}

/**
 * 解析本次请求实际生效的 LLM 配置：用户 BYOK 优先；没配齐则回退试用通道。
 * 两者都不可用返回 null（调用方给出引导文案）。
 * 试用模式下 apiKey 只是占位符——真正的 key 由 edge function 在服务端注入。
 */
export function resolveLlm(): ResolvedLlm | null {
  const { endpoint, apiKey, model } = useSettings.getState();
  if (endpoint && apiKey && model) {
    return { config: { endpoint, apiKey, model }, trial: false };
  }
  const trial = useTrial.getState();
  if (trial.status === "available" && trial.model) {
    return {
      config: { endpoint: TRIAL_BASE_URL, apiKey: "trial", model: trial.model },
      trial: true,
    };
  }
  return null;
}
