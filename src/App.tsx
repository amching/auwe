import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { PageFallback, RootLayout } from "@/components/layout/RootLayout";
import { RouteError } from "@/components/layout/RouteError";
import {
  loadHome,
  loadPolish,
  loadResume,
  loadTool,
  loadTools,
  loadToolsLayout,
  loadToolView,
} from "@/lib/pageModules";

// Data-router lazy modules start in parallel for every matched route, including
// tool implementations via the loader. Parent rendering no longer gates downloads.
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteError />,
    HydrateFallback: PageFallback,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await loadHome()).HomePage }),
        errorElement: <RouteError />,
      },
      {
        path: "resume",
        lazy: async () => ({ Component: (await loadResume()).ResumePage }),
        errorElement: <RouteError />,
      },
      {
        path: "polish",
        lazy: async () => ({ Component: (await loadPolish()).PolishPage }),
        errorElement: <RouteError />,
      },
      {
        path: "tools",
        lazy: async () => ({
          Component: (await loadToolsLayout()).ToolsLayout,
        }),
        errorElement: <RouteError />,
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await loadTools()).ToolsPage }),
            errorElement: <RouteError />,
          },
          {
            path: ":slug",
            lazy: async () => ({ Component: (await loadToolView()).ToolView }),
            loader: async ({ params }) => {
              await loadTool(params.slug);
              return null;
            },
            errorElement: <RouteError />,
          },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
