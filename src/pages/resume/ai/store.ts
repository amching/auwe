import { create } from "zustand";
import { streamCompletion } from "@/lib/llm/client";
import { describeLlmError } from "@/lib/llm/errors";
import { resolveLlm } from "@/lib/llm/trial";
import { useResume } from "@/stores/resume";
import { buildResumeAiPrompt, extractSuggestion } from "./prompts";

/**
 * 简历 AI 优化会话（不持久化：范围偏移与 Markdown 强绑定，跨会话没有意义）。
 *
 * 状态机：
 * - idle       面板打开但本轮还没发请求（或已放弃/已撤销）
 * - streaming  正在流式生成
 * - reviewing  已有建议，等用户在编辑器 Diff 里接受/拒绝/继续调整
 * - applied    已写回正文，可撤销
 * - error      本轮失败（target 保留，可重试）
 *
 * 铁律第 3 条：请求走 streamCompletion 流式；suggestion 随 chunk 累加。
 * 关键约束：AI 结果永不直接写回 useResume——只有 apply() 这一条路径落盘。
 */

export type AiStatus = "idle" | "streaming" | "reviewing" | "applied" | "error";

export interface AiTarget {
  /** 在 Markdown 文档中的偏移（发起会话那一刻的坐标）。 */
  from: number;
  to: number;
  /** 发起时的原文快照；apply 前会用它校验正文没被改过。 */
  text: string;
  /** 结构面包屑，如「工作经历 / 某某科技 / 第 2 条」。 */
  scope: string;
}

export interface AiRound {
  instruction: string;
  suggestion: string;
}

export interface ResumeAiState {
  panelTab: "preview" | "ai";
  target: AiTarget | null;
  status: AiStatus;
  /** 流式累加缓冲；status 为 reviewing/applied 时即当前建议全文。 */
  suggestion: string;
  /** 已完成的轮次（含当前建议），驱动面板对话区。 */
  rounds: AiRound[];
  error: string | null;
  /** 最近一次 apply 的前后全文快照，撤销用。 */
  lastApplied: { before: string; after: string } | null;
  /** 每次需要重挂 Diff 装饰时 +1（如撤销后恢复审阅）。 */
  diffEpoch: number;

  setPanelTab: (tab: "preview" | "ai") => void;
  /** 打开面板并锁定优化目标；清空上一个目标的轮次。 */
  openWith: (target: AiTarget) => void;
  /** 清空目标（重新选择）。流式中会先中断请求。 */
  clearTarget: () => void;
  /** 发起一轮生成；reviewing 状态下再次调用即「继续调整」。 */
  start: (instruction: string) => Promise<void>;
  /** 中断进行中的流式请求。 */
  abort: () => void;
  /** 接受建议：唯一写回 useResume 的路径。 */
  apply: () => void;
  /** 拒绝当前建议：清 Diff，目标保留，可重来。 */
  discard: () => void;
  /** 撤销最近一次 AI 修改（正文未被再次编辑时可用）。 */
  undoApply: () => void;
}

let controller: AbortController | null = null;

export const useResumeAi = create<ResumeAiState>()((set, get) => ({
  panelTab: "preview",
  target: null,
  status: "idle",
  suggestion: "",
  rounds: [],
  error: null,
  lastApplied: null,
  diffEpoch: 0,

  setPanelTab: (tab) => set({ panelTab: tab }),

  openWith: (target) => {
    get().abort();
    set({
      panelTab: "ai",
      target,
      status: "idle",
      suggestion: "",
      rounds: [],
      error: null,
    });
  },

  clearTarget: () => {
    get().abort();
    set({
      target: null,
      status: "idle",
      suggestion: "",
      rounds: [],
      error: null,
    });
  },

  start: async (instruction) => {
    const { target, status, suggestion } = get();
    if (!target || status === "streaming") return;

    // BYOK 优先，否则回退官方试用通道（配置解析见 lib/llm/trial.ts）。
    const resolved = resolveLlm();
    if (!resolved) {
      set({
        status: "error",
        error:
          "还没配置 AI，且试用通道不可用。请在设置里填入 Endpoint、API Key 和 Model。",
      });
      return;
    }

    // 已有建议时视为「继续调整」：在上一版基础上改。
    const base = status === "reviewing" ? suggestion : undefined;
    const prompt = buildResumeAiPrompt({
      original: target.text,
      scope: target.scope,
      instruction,
      base,
    });

    controller = new AbortController();
    const signal = controller.signal;
    set({
      status: "streaming",
      suggestion: "",
      error: null,
      rounds: [...get().rounds, { instruction, suggestion: "" }],
    });
    try {
      let acc = "";
      for await (const chunk of streamCompletion(resolved.config, prompt, {
        signal,
      })) {
        acc += chunk;
        // 边流边提取：模型若回显 prompt 脚手架，这里就不会显示成建议正文。
        set({ suggestion: extractSuggestion(acc) });
      }
      const clean = extractSuggestion(acc);
      if (!clean.trim()) {
        set({
          status: "error",
          // 与接口层错误（describeLlmError）区分：接口是通的，是内容出了问题。
          error: "接口调用成功，但模型没有返回有效内容，请重试或换个说法。",
          rounds: get().rounds.slice(0, -1),
        });
        return;
      }
      set((s) => ({
        status: "reviewing",
        suggestion: clean,
        rounds: [...s.rounds.slice(0, -1), { instruction, suggestion: clean }],
        diffEpoch: s.diffEpoch + 1,
      }));
    } catch (err) {
      if (signal.aborted) {
        // 用户主动放弃：回到发起前的状态，不算错误。
        set((s) => ({
          status: s.rounds.length > 1 ? "reviewing" : "idle",
          suggestion: base ?? "",
          rounds: s.rounds.slice(0, -1),
          diffEpoch: s.diffEpoch + 1,
        }));
        return;
      }
      set({
        status: "error",
        error: describeLlmError(err, { trial: resolved.trial }),
        rounds: get().rounds.slice(0, -1),
      });
    } finally {
      controller = null;
    }
  },

  abort: () => {
    controller?.abort();
    controller = null;
  },

  apply: () => {
    const { target, suggestion, status } = get();
    if (!target || status !== "reviewing" || !suggestion.trim()) return;

    const { markdown, setMarkdown } = useResume.getState();
    // 原文快照校验：正文若已被改动（理论上审阅期编辑器只读，进不来），拒绝盲写。
    if (markdown.slice(target.from, target.to) !== target.text) {
      set({ status: "error", error: "原文已发生变化，请重新选择内容后再试。" });
      return;
    }
    const after =
      markdown.slice(0, target.from) + suggestion + markdown.slice(target.to);
    setMarkdown(after);
    set({ status: "applied", lastApplied: { before: markdown, after } });
  },

  discard: () => {
    const { status } = get();
    if (status === "streaming") {
      get().abort();
      return;
    }
    set({ status: "idle", suggestion: "", error: null });
  },

  undoApply: () => {
    const { lastApplied } = get();
    if (!lastApplied) return;
    const { markdown, setMarkdown } = useResume.getState();
    // 应用后正文又被手动编辑过就不能整体回滚了（按钮侧也会禁用，这里兜底）。
    if (markdown !== lastApplied.after) return;
    setMarkdown(lastApplied.before);
    set((s) => ({
      status: "reviewing",
      lastApplied: null,
      diffEpoch: s.diffEpoch + 1,
    }));
  },
}));
