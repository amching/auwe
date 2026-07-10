/**
 * 简历视觉模板注册表。
 *
 * 一个模板 = 一套简历纸配色（--paper-* token），定义在 templates.css 的
 * [data-resume-template="<id>"] 块里；版式（字阶/间距/结构）在 resume.css，所有模板共用。
 * 生效方式：把 data-resume-template 写在预览两个容器（ResumePreview）与打印 #print-root
 * （usePrintResume）上，token 靠 CSS 继承下发到页框与纸的克隆，无须逐节点携带。
 *
 * 新增模板三步：① ResumeTemplateId 加 id；② 此处登记；③ templates.css 加同 id 的 token 块。
 */
export type ResumeTemplateId = "clean";

export interface ResumeTemplate {
  id: ResumeTemplateId;
  /** 展示名（供将来的模板切换 UI）。 */
  label: string;
}

export const RESUME_TEMPLATES: readonly ResumeTemplate[] = [
  { id: "clean", label: "Clean" },
];

export const DEFAULT_RESUME_TEMPLATE: ResumeTemplateId = "clean";

export function getResumeTemplate(id: ResumeTemplateId): ResumeTemplate {
  // 注册表以 id 为键且 ResumeTemplateId 是闭合联合类型，必命中。
  return RESUME_TEMPLATES.find((t) => t.id === id) as ResumeTemplate;
}
