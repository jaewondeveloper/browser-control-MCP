#!/usr/bin/env node
/**
 * MCP entry — runs dist in THIS process so Cursor stdio stays connected.
 * (Do not spawn a child: that breaks MCP JSON-RPC on stdin/stdout.)
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const entry = path.join(root, "dist", "index.js");
await import(pathToFileURL(entry).href);
