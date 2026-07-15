import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PromptAnalysis } from "@/pages/prompt/analysis";

/**
 * 解构页的持久化状态：Prompt 草稿 + 最近一次解构结果 → localStorage。
 * 页面级 lazy 路由一切换组件就卸载，不落盘的话原文和结果都会丢。
 *
 * 结果必须和它所依据的原文快照（source）成对存取：片段的 from/to 偏移
 * 以 source 为坐标系，拆开存会导致高亮错位。过期判断（input !== source）
 * 也因此在刷新/切页后依然成立。
 */

export interface DeconstructResult {
  analysis: PromptAnalysis;
  /** 分析所依据的原文快照：判断结果是否过期 + 片段偏移的坐标系。 */
  source: string;
}

interface PromptStudioState {
  input: string;
  result: DeconstructResult | null;
  setInput: (input: string) => void;
  setResult: (result: DeconstructResult | null) => void;
}

/** 粗校验持久化的结果形状，防止旧版本/损坏数据在渲染期炸掉。 */
function sanitizeResult(value: unknown): DeconstructResult | null {
  const r = value as DeconstructResult | null | undefined;
  if (
    r &&
    typeof r.source === "string" &&
    typeof r.analysis === "object" &&
    r.analysis !== null &&
    typeof r.analysis.skeleton === "string" &&
    typeof r.analysis.summary?.coreIntent === "string" &&
    Array.isArray(r.analysis.logicFlow) &&
    Array.isArray(r.analysis.principles)
  ) {
    return r;
  }
  return null;
}

export const usePromptStudio = create<PromptStudioState>()(
  persist(
    (set) => ({
      input: "",
      result: null,
      setInput: (input) => set({ input }),
      setResult: (result) => set({ result }),
    }),
    {
      name: "auwe-prompt",
      version: 0,
      merge: (persisted, current) => {
        const p = persisted as Partial<PromptStudioState> | undefined;
        return {
          ...current,
          input: typeof p?.input === "string" ? p.input : "",
          result: sanitizeResult(p?.result),
        };
      },
    },
  ),
);
