import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { reloadOnceForStaleChunk } from "@/lib/chunkReload";
import App from "./App.tsx";

/**
 * 部署后旧分包 404 的自愈入口（见 lib/chunkReload.ts）。
 *
 * Vite 在动态 import 的依赖预加载失败时会派发 `vite:preloadError`；默认行为是
 * 把错误抛出去、由错误边界接住。这里抢先重载一次拿新版本，只有重载也救不回来
 * （冷却期内）才放行给 RouteError 展示。
 *
 * 必须在任何 lazy import 之前注册——所以放在 main.tsx 顶部、render 之前。
 */
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForStaleChunk()) event.preventDefault();
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
