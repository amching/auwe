import type { SyntheticEvent } from "react";
import { preloadPage } from "./pageModules";

/** Delegated to the app shell, so cards and button-rendered links work too. */
export function preloadNavigation(event: SyntheticEvent) {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (
    connection?.saveData ||
    /(^|-)2g$/.test(connection?.effectiveType ?? "")
  ) {
    return;
  }

  const target = event.target;
  const link = target instanceof Element ? target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement)) return;
  if (
    link.hasAttribute("download") ||
    (link.target && link.target !== "_self")
  ) {
    return;
  }
  const url = new URL(link.href);
  if (url.origin !== window.location.origin) return;
  if (url.pathname === window.location.pathname) return;

  // A speculative failure must never interrupt the current page or auto-reload it.
  void preloadPage(url.pathname).catch(() => {});
}
