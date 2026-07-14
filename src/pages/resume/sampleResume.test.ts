import { describe, expect, it } from "vitest";
import {
  LEGACY_TUTORIAL_COMMENT,
  SAMPLE_RESUME,
  stripLegacyTutorialComment,
} from "./sampleResume";

describe("stripLegacyTutorialComment", () => {
  it("剥离旧版系统教学注释及其后的空行", () => {
    const legacy = `${LEGACY_TUTORIAL_COMMENT}\n\n# 石青\n\n正文内容`;
    expect(stripLegacyTutorialComment(legacy)).toBe("# 石青\n\n正文内容");
  });

  it("用户自己的内容（含自写注释）原样保留", () => {
    const own = "# 我的简历\n\n<!-- 我自己的备注 -->\n\n## 工作经历";
    expect(stripLegacyTutorialComment(own)).toBe(own);
  });

  it("被用户改动过的教学注释不再匹配、不剥离", () => {
    const edited = `${LEGACY_TUTORIAL_COMMENT.replace("约定优于语法", "我改过了")}\n\n# 简历`;
    expect(stripLegacyTutorialComment(edited)).toBe(edited);
  });

  it("新默认模板不含 HTML 注释", () => {
    expect(SAMPLE_RESUME).not.toContain("<!--");
  });
});
