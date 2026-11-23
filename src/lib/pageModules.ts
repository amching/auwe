import { moduleLoader } from "./moduleLoader";

export const loadHome = moduleLoader(() => import("@/pages/home/HomePage"));
export const loadResume = moduleLoader(
  () => import("@/pages/resume/ResumePage"),
);
export const loadPolish = moduleLoader(
  () => import("@/pages/polish/PolishPage"),
);
export const loadToolsLayout = moduleLoader(
  () => import("@/pages/tools/ToolsLayout"),
);
export const loadTools = moduleLoader(() => import("@/pages/tools/ToolsPage"));
export const loadToolView = moduleLoader(
  () => import("@/pages/tools/ToolView"),
);
const loadRegistry = moduleLoader(() => import("@/pages/tools/registry"));

export async function loadTool(slug: string | undefined) {
  const { getTool } = await loadRegistry();
  await getTool(slug)?.preload?.();
}

/** Start every level together instead of waiting for parent components to render. */
export async function preloadPage(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") await loadHome();
  else if (path === "/resume") await loadResume();
  else if (path === "/polish") await loadPolish();
  else if (path === "/tools") {
    await Promise.all([loadToolsLayout(), loadTools()]);
  } else {
    const match = /^\/tools\/([^/]+)$/.exec(path);
    if (match) {
      await Promise.all([
        loadToolsLayout(),
        loadToolView(),
        loadTool(decodeURIComponent(match[1])),
      ]);
    }
  }
}
