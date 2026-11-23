import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const modules = vi.hoisted(() => ({
  loadHome: vi.fn(),
  loadResume: vi.fn(),
  loadPolish: vi.fn(),
  loadToolsLayout: vi.fn(),
  loadTools: vi.fn(),
  loadToolView: vi.fn(),
  loadTool: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/pageModules", () => modules);
vi.mock("@/components/layout/RootLayout", () => ({
  RootLayout: () => <Outlet />,
  PageFallback: () => <p>Loading</p>,
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

it("starts a direct tool navigation before its parent layout has loaded", async () => {
  let finishLayout!: (value: { ToolsLayout: () => React.ReactNode }) => void;
  modules.loadToolsLayout.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishLayout = resolve;
      }),
  );
  modules.loadToolView.mockResolvedValue({
    ToolView: () => <h1>JSON tool</h1>,
  });
  window.history.replaceState(null, "", "/tools/json");
  const { default: App } = await import("./App");
  render(<App />);

  // These must start while the parent module is still blocked.
  await waitFor(() => {
    expect(modules.loadToolView).toHaveBeenCalledOnce();
    expect(modules.loadTool).toHaveBeenCalledWith("json");
  });
  expect(screen.queryByText("JSON tool")).not.toBeInTheDocument();
  finishLayout({ ToolsLayout: () => <Outlet /> });
  expect(await screen.findByText("JSON tool")).toBeInTheDocument();
});
