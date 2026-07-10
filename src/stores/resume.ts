import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SAMPLE_RESUME } from "@/pages/resume/sampleResume";

export interface ResumeState {
  /** 唯一事实源：一段 Markdown 字符串。 */
  markdown: string;
  /** 最后编辑时间戳。 */
  updatedAt: number;
  setMarkdown: (md: string) => void;
  resetToSample: () => void;
}

export const useResume = create<ResumeState>()(
  persist(
    (set) => ({
      markdown: SAMPLE_RESUME,
      updatedAt: 0,
      setMarkdown: (md) => set({ markdown: md, updatedAt: Date.now() }),
      resetToSample: () =>
        set({ markdown: SAMPLE_RESUME, updatedAt: Date.now() }),
    }),
    // version 为将来迁移到多份简历 { documents: [...] } 留门。
    { name: "auwe-resume", version: 1 },
  ),
);
