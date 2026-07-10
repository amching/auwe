import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SAMPLE_RESUME } from "@/pages/resume/sampleResume";
import {
  DEFAULT_RESUME_TEMPLATE,
  type ResumeTemplateId,
} from "@/pages/resume/templates";

export interface ResumeState {
  /** 唯一事实源：一段 Markdown 字符串。 */
  markdown: string;
  /** 最后编辑时间戳。 */
  updatedAt: number;
  /** 视觉模板 id（配色与版式细则，见 pages/resume/templates.ts）。 */
  template: ResumeTemplateId;
  setMarkdown: (md: string) => void;
  setTemplate: (template: ResumeTemplateId) => void;
  resetToSample: () => void;
}

export const useResume = create<ResumeState>()(
  persist(
    (set) => ({
      markdown: SAMPLE_RESUME,
      updatedAt: 0,
      template: DEFAULT_RESUME_TEMPLATE,
      setMarkdown: (md) => set({ markdown: md, updatedAt: Date.now() }),
      setTemplate: (template) => set({ template }),
      resetToSample: () =>
        set({ markdown: SAMPLE_RESUME, updatedAt: Date.now() }),
    }),
    // version 为将来迁移到多份简历 { documents: [...] } 留门。
    { name: "auwe-resume", version: 1 },
  ),
);
