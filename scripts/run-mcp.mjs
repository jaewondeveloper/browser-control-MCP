#!/usr/bin/env node
/**
 * Always loads the latest dist build (avoids stale MCP Node cache).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "dist", "index.js");

console.error(`[browser-control-mcp] launcher → ${entry}`);

const child = spawn(process.execPath, [entry], {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env, BROWSER_CONTROL_LAUNCHER: "run-mcp.mjs" },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
