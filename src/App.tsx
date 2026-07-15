import { lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RootLayout } from "@/components/layout/RootLayout";

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

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      // 首页暂为占位（待做落地页）；简历工作台在 /resume。
      { index: true, element: <HomePage /> },
      { path: "resume", element: <ResumePage /> },
      { path: "polish", element: <PolishPage /> },
      { path: "prompt", element: <PromptPage /> },
      {
        path: "tools",
        element: <ToolsLayout />,
        children: [
          { index: true, element: <ToolsPage /> },
          { path: ":slug", element: <ToolView /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
