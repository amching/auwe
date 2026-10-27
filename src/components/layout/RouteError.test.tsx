import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { RouteError } from "./RouteError";

/**
 * 用内存路由触发真实的 errorElement 链路（而不是直接渲染组件）：
 * 页面 lazy 加载失败时要能看到「版本已过期」的文案，而不是 React Router 的默认错误页。
 */

afterEach(cleanup);

function renderWithThrowingPage(error: Error) {
  const router = createMemoryRouter([
    {
      path: "/",
      children: [
        {
          index: true,
          element: <p>ok</p>,
          errorElement: <RouteError />,
          loader: () => {
            throw error;
          },
        },
      ],
    },
  ]);
  return render(<RouterProvider router={router} />);
}

describe("RouteError", () => {
  it("分包 404：提示版本已过期，并给出刷新入口", async () => {
    renderWithThrowingPage(
      new TypeError(
        "Failed to fetch dynamically imported module: https://auwe.app/assets/ToolsLayout-BkXL0ms3.js",
      ),
    );

    expect(await screen.findByText("页面版本已过期")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /刷新页面/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /回到首页/ })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("普通渲染错误：不误导用户去刷新版本，但仍给恢复入口", async () => {
    renderWithThrowingPage(new Error("Cannot read properties of null"));

    expect(await screen.findByText("页面出了点问题")).toBeInTheDocument();
    expect(screen.queryByText("页面版本已过期")).not.toBeInTheDocument();
    // 原始信息收在「技术细节」里，方便用户反馈
    expect(
      screen.getByText(/Cannot read properties of null/),
    ).toBeInTheDocument();
  });
});
