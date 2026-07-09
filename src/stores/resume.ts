import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RESUME_TEMPLATE } from "@/pages/resume/resumeTemplate";

export interface ResumeState {
  /** 唯一事实源：一段 Markdown 字符串。 */
  markdown: string;
  /** 最后编辑时间戳。 */
  updatedAt: number;
  setMarkdown: (md: string) => void;
  resetToTemplate: () => void;
}

export const useResume = create<ResumeState>()(
  persist(
    (set) => ({
      markdown: RESUME_TEMPLATE,
      updatedAt: 0,
      setMarkdown: (md) => set({ markdown: md, updatedAt: Date.now() }),
      resetToTemplate: () =>
        set({ markdown: RESUME_TEMPLATE, updatedAt: Date.now() }),
    }),
    // version 为将来迁移到多份简历 { documents: [...] } 留门。
    { name: "auwe-resume", version: 1 },
  ),
);
