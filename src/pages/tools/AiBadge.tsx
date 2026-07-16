/**
 * 「AI」徽记：标记需要 AI 能力的工具（registry 里 ai: true）。
 * 刻意克制——单色发丝边小字，只做区分，不做装饰。
 */
export function AiBadge() {
  return (
    <span
      title="需要 AI 能力（可用自己的 API Key，或官方试用通道）"
      className="inline-flex shrink-0 items-center rounded border px-1 py-px font-mono text-[0.625rem] leading-none text-muted-foreground"
    >
      AI
    </span>
  );
}
