import { json } from "./responses";
import { handleTrial, type TrialConfig } from "./trial";

export default {
  async fetch(request: Request, env: Env & TrialConfig): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      const path = pathname.replace(/\/$/, "");
      if (path === "/api/trial" || path.startsWith("/api/trial/")) {
        try {
          return await handleTrial(
            request,
            env,
            path === "/api/trial" ? "" : path.slice("/api/trial/".length),
          );
        } catch {
          // Never log request bodies, credentials, or upstream exception messages.
          return json({ error: "trial upstream unavailable" }, 502);
        }
      }
      return json({ error: "not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env & TrialConfig>;
