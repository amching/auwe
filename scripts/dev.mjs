import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}

function start(entry, args) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  children.push(child);
  child.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.once("exit", (code) => stop(code ?? 1));
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

// Vite serves the live frontend; only /api requests are proxied to Wrangler.
// Override production assets so a fresh checkout doesn't need dist/ to develop.
start("node_modules/wrangler/bin/wrangler.js", [
  "dev",
  "--assets",
  "./public",
  "--ip",
  "127.0.0.1",
  "--port",
  "8787",
]);
start("node_modules/vite/bin/vite.js", process.argv.slice(2));
