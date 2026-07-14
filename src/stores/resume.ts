import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  SAMPLE_RESUME,
  stripLegacyTutorialComment,
} from "@/pages/resume/sampleResume";
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
    {
      name: "auwe-resume",
      // v2：格式教程从正文迁出为「格式指南」弹窗。迁移只剥离逐字匹配的旧系统
      // 教学注释（指纹见 LEGACY_TUTORIAL_COMMENT），用户自己的内容一律不动。
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Partial<ResumeState> | undefined;
        if (version < 2 && state && typeof state.markdown === "string") {
          state.markdown = stripLegacyTutorialComment(state.markdown);
        }
        return state as ResumeState;
      },
    },
  ),
);
