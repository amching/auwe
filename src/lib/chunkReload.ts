/**
 * 部署后旧分包失效的自愈逻辑。
 *
 * 场景：hash 命名的分包（如 `ToolsLayout-BkXL0ms3.js`）每次部署都会换名字，
 * 而用户浏览器里可能还开着旧版页面。当他点开一个此前没加载过的路由时，
 * 旧页面按旧 hash 去取文件 → 404 → 「Failed to fetch dynamically imported module」。
 *
 * 处理：认出这类失败 → 重载一次页面拿新的 index.html（从而拿到新 hash）。
 * 重载也治不好时（离线 / 部署本身有问题）必须在冷却期内放弃、交给错误页，
 * 否则会无限刷新。
 */

const RELOAD_AT_KEY = "auwe:stale-chunk-reload-at";

/** 两次自动重载的最小间隔：小于它说明「刚重载过还是坏的」，不再重试。 */
export const RELOAD_COOLDOWN_MS = 10_000;

/** 浏览器与 Vite 在分包 404 / 断流时抛出的各种措辞（各浏览器不统一）。 */
const STALE_CHUNK_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|Importing a module script failed|ChunkLoadError/i;

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return STALE_CHUNK_RE.test(message);
}

/**
 * 纯判定：距离上次自动重载是否已越过冷却期。
 * 单独抽出来是为了能不碰浏览器 API 地测试这条最怕写错的规则。
 */
export function shouldReloadForStaleChunk(
  now: number,
  lastReloadAt: number | null,
  cooldownMs: number = RELOAD_COOLDOWN_MS,
): boolean {
  if (lastReloadAt === null || !Number.isFinite(lastReloadAt)) return true;
  return now - lastReloadAt >= cooldownMs;
}

/** 自动重载一次；返回 false 表示「放弃」，调用方应展示错误页。 */
export function reloadOnceForStaleChunk(): boolean {
  let lastReloadAt: number | null;
  try {
    const raw = sessionStorage.getItem(RELOAD_AT_KEY);
    lastReloadAt = raw === null ? null : Number(raw);
  } catch {
    // 拿不到 sessionStorage 就无从防循环：宁可不刷新，也不要转圈。
    return false;
  }

  if (!shouldReloadForStaleChunk(Date.now(), lastReloadAt)) return false;

  try {
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  } catch {
    return false;
  }

  window.location.reload();
  return true;
}
