/**
 * 结果面板 loading 的视觉零件（纯展示）。动画克制、尊重 prefers-reduced-motion：
 * - 进度条：CSS 不确定滑动，reduce-motion 下退化为静止半透明满条（见 index.css）。
 * - 骨架屏：轻微 pulse，reduce-motion 下停止（motion-reduce:animate-none）。
 */

/** 顶部不确定进度条（不表示百分比）。装饰性，交给 live region 播报状态。 */
export function IndeterminateBar() {
  return (
    <div
      aria-hidden
      className="indeterminate-track h-0.5 w-full rounded-full bg-primary/15"
    >
      <span className="indeterminate-bar" />
    </div>
  );
}

// 骨架行宽度：模拟一份短日报的结构（首行偏短像小标题，其后长短交错像要点）。
const SKELETON_LINES = ["45%", "92%", "78%", "88%", "64%", "82%"];

/** 首次生成的骨架屏：接近最终正文高度，避免结果返回时布局跳动。 */
export function ReportSkeleton() {
  return (
    <div aria-hidden className="space-y-2.5">
      {SKELETON_LINES.map((w, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: 固定的静态占位行，无重排
          key={i}
          className="h-3.5 animate-pulse rounded bg-muted motion-reduce:animate-none"
          style={{ width: w }}
        />
      ))}
    </div>
  );
}
