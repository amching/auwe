import { describe, expect, it } from "vitest";
import {
  isChunkLoadError,
  RELOAD_COOLDOWN_MS,
  shouldReloadForStaleChunk,
} from "./chunkReload";

describe("isChunkLoadError", () => {
  it("认得各浏览器对分包 404 的说法", () => {
    const messages = [
      "Failed to fetch dynamically imported module: https://auwe.app/assets/ToolsLayout-BkXL0ms3.js",
      "error loading dynamically imported module: /assets/ToolsLayout.js",
      "Importing a module script failed.",
      "Unable to preload CSS for /assets/index-abc.css",
      "ChunkLoadError: Loading chunk 3 failed.",
    ];
    for (const m of messages) {
      expect(isChunkLoadError(new Error(m)), m).toBe(true);
    }
  });

  it("普通渲染错误不算", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of null"))).toBe(
      false,
    );
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError({ message: "whatever" })).toBe(false);
  });
});

describe("shouldReloadForStaleChunk", () => {
  const NOW = 1_700_000_000_000;

  it("从没重载过 → 可以重载", () => {
    expect(shouldReloadForStaleChunk(NOW, null)).toBe(true);
  });

  it("冷却期内 → 不再重载（防止刷新死循环）", () => {
    expect(shouldReloadForStaleChunk(NOW, NOW - RELOAD_COOLDOWN_MS + 1)).toBe(
      false,
    );
  });

  it("刚好越过冷却期 → 可以重载", () => {
    expect(shouldReloadForStaleChunk(NOW, NOW - RELOAD_COOLDOWN_MS)).toBe(true);
  });

  it("sessionStorage 里的脏值不会把自己锁死", () => {
    expect(shouldReloadForStaleChunk(NOW, Number.NaN)).toBe(true);
  });
});
