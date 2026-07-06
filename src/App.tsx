import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RootLayout } from "@/components/layout/RootLayout";
import { PolishPage } from "@/pages/polish/PolishPage";
import { ResumePage } from "@/pages/resume/ResumePage";
import { ToolsPage } from "@/pages/tools/ToolsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <ResumePage /> },
      { path: "polish", element: <PolishPage /> },
      { path: "tools", element: <ToolsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
