import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 「人生设计师」的对话记录 → localStorage。
 * 这是一场可能持续半小时以上的多轮深度对话，路由切换（工具页是 lazy 组件，
 * 一切走就卸载）或刷新都不该让用户前功尽弃。
 * 只存已完成的回合；流式中的半截回复是瞬态，留在 hook 里。
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface LifeDesignState {
  messages: ChatTurn[];
  setMessages: (messages: ChatTurn[]) => void;
  reset: () => void;
}

/** 粗校验持久化的对话形状，防止旧版本/损坏数据在渲染期炸掉。 */
function sanitizeMessages(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is ChatTurn =>
      t !== null &&
      typeof t === "object" &&
      (t.role === "user" || t.role === "assistant") &&
      typeof t.content === "string",
  );
}

export const useLifeDesign = create<LifeDesignState>()(
  persist(
    (set) => ({
      messages: [],
      setMessages: (messages) => set({ messages }),
      reset: () => set({ messages: [] }),
    }),
    {
      name: "auwe-lifedesign",
      version: 0,
      merge: (persisted, current) => ({
        ...current,
        messages: sanitizeMessages(
          (persisted as Partial<LifeDesignState> | undefined)?.messages,
        ),
      }),
    },
  ),
);
