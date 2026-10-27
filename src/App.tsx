import { lazy, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RootLayout } from "@/components/layout/RootLayout";
import { RouteError } from "@/components/layout/RouteError";

// 路由级 code-split：CodeMirror 只落进 Resume chunk，Polish/Tools 不再拖它。
// Suspense 边界在 RootLayout 的 <Outlet> 外统一兜底。
const HomePage = lazy(() =>
  import("@/pages/home/HomePage").then((m) => ({ default: m.HomePage })),
);
const ResumePage = lazy(() =>
  import("@/pages/resume/ResumePage").then((m) => ({ default: m.ResumePage })),
);
const PolishPage = lazy(() =>
  import("@/pages/polish/PolishPage").then((m) => ({ default: m.PolishPage })),
);
const PromptPage = lazy(() =>
  import("@/pages/prompt/PromptPage").then((m) => ({ default: m.PromptPage })),
);
const ToolsLayout = lazy(() =>
  import("@/pages/tools/ToolsLayout").then((m) => ({ default: m.ToolsLayout })),
);
const ToolsPage = lazy(() =>
  import("@/pages/tools/ToolsPage").then((m) => ({ default: m.ToolsPage })),
);
const ToolView = lazy(() =>
  import("@/pages/tools/ToolView").then((m) => ({ default: m.ToolView })),
);

/**
 * 每个页面都挂同一个 errorElement：分包 404（部署后旧 hash 失效）、渲染异常都在
 * 页面区域内接住，顶部导航仍在，用户能直接去别的页面而不是掉进白屏错误页。
 * 没配 errorElement 时 React Router 会显示它自带的「Unexpected Application Error!」。
 */
const page = (element: ReactNode) => ({
  element,
  errorElement: <RouteError />,
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    // 兜底：RootLayout 自身（含顶层懒加载）出错时至少有个像样的页面。
    errorElement: <RouteError />,
    children: [
      // 首页 = 产品落地页；简历工作台在 /resume。
      { index: true, ...page(<HomePage />) },
      { path: "resume", ...page(<ResumePage />) },
      { path: "polish", ...page(<PolishPage />) },
      { path: "prompt", ...page(<PromptPage />) },
      {
        path: "tools",
        ...page(<ToolsLayout />),
        children: [
          { index: true, ...page(<ToolsPage />) },
          { path: ":slug", ...page(<ToolView />) },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
