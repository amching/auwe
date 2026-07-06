import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

describe("MarkdownPreview", () => {
  it("renders basic markdown", () => {
    const { container } = render(<MarkdownPreview># Hello</MarkdownPreview>);
    expect(container.querySelector("h1")?.textContent).toBe("Hello");
  });

  it("strips script tags (CLAUDE.md rule 2)", () => {
    const malicious = "safe text\n\n<script>window.__xss = true</script>";
    const { container } = render(
      <MarkdownPreview>{malicious}</MarkdownPreview>,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("safe text");
  });

  it("strips javascript: link hrefs", () => {
    const malicious = "[click](javascript:alert(1))";
    const { container } = render(
      <MarkdownPreview>{malicious}</MarkdownPreview>,
    );
    const href = container.querySelector("a")?.getAttribute("href") ?? "";
    expect(href.startsWith("javascript:")).toBe(false);
  });
});
