import { defaultSchema } from "rehype-sanitize";

/**
 * Shared sanitize schema for all Markdown rendering (CLAUDE.md rule 2).
 * Rendered Markdown is untrusted — user input AND LLM output — so every
 * render path must go through this. Starts from rehype-sanitize's safe
 * default and additionally allows GFM task-list checkboxes.
 */
export const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    input: [
      ...(defaultSchema.attributes?.input ?? []),
      "checked",
      "disabled",
      "type",
    ],
  },
};
