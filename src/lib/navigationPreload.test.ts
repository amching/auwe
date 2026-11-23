import type { SyntheticEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadNavigation } from "./navigationPreload";
import { preloadPage } from "./pageModules";

vi.mock("./pageModules", () => ({
  preloadPage: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  vi.clearAllMocks();
  Reflect.deleteProperty(navigator, "connection");
});

function intent(href: string, attributes = "") {
  const container = document.createElement("div");
  container.innerHTML = `<a href="${href}" ${attributes}><span>Open</span></a>`;
  preloadNavigation({
    target: container.querySelector("span"),
  } as unknown as SyntheticEvent);
}

describe("navigation preload", () => {
  it("finds links through nested card content", () => {
    intent("/tools/json");
    expect(preloadPage).toHaveBeenCalledWith("/tools/json");
  });

  it("ignores external links, downloads, new tabs and the current page", () => {
    intent("https://example.com/resume");
    intent("/resume", "download");
    intent("/resume", 'target="_blank"');
    intent(window.location.pathname);
    expect(preloadPage).not.toHaveBeenCalled();
  });

  it("respects data saving and slow connections", () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
    intent("/resume");
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { effectiveType: "slow-2g" },
    });
    intent("/tools/json");
    expect(preloadPage).not.toHaveBeenCalled();
  });

  it("handles speculative failures without interrupting the current page", async () => {
    vi.mocked(preloadPage).mockRejectedValueOnce(
      new Error("Failed to fetch dynamically imported module"),
    );
    intent("/resume");
    await Promise.resolve();
    expect(preloadPage).toHaveBeenCalledWith("/resume");
  });
});
