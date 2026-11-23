import { describe, expect, it, vi } from "vitest";
import { moduleLoader } from "./moduleLoader";

describe("moduleLoader", () => {
  it("shares in-flight and completed imports between prefetch and navigation", async () => {
    let finish!: (value: string) => void;
    const importer = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const load = moduleLoader(importer);
    const preload = load();
    expect(load()).toBe(preload);
    finish("ready");
    await expect(preload).resolves.toBe("ready");
    expect(load()).toBe(preload);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it("allows navigation to retry after a speculative download fails", async () => {
    const importer = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("ready");
    const load = moduleLoader(importer);
    await expect(load()).rejects.toThrow("offline");
    await expect(load()).resolves.toBe("ready");
  });
});
