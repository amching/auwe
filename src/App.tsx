import { lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RootLayout } from "@/components/layout/RootLayout";

// 路由级 code-split：CodeMirror 只落进 Resume chunk，Polish/Tools 不再拖它。
// Suspense 边界在 RootLayout 的 <Outlet> 外统一兜底。
const ResumePage = lazy(() =>
  import("@/pages/resume/ResumePage").then((m) => ({ default: m.ResumePage })),
);
const PolishPage = lazy(() =>
  import("@/pages/polish/PolishPage").then((m) => ({ default: m.PolishPage })),
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
      { index: true, element: <ResumePage /> },
      { path: "polish", element: <PolishPage /> },
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
