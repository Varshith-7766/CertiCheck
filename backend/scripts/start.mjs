#!/usr/bin/env node
/**
 * Production-aware start script.
 *
 * On Render (`RENDER=true`) or `NODE_ENV=production`, pushes the Prisma
 * schema to the database first (creates tables on a fresh Neon DB;
 * idempotent no-op when already in sync), then starts the server.
 * Locally it just starts the server — dev DB handling is left to
 * `npm run db:push` / `db:migrate` as before.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");

const onRender = process.env.RENDER === "true" || process.env.NODE_ENV === "production";

function run(cmd, args, useShell) {
  const r = spawnSync(cmd, args, { cwd: backendDir, stdio: "inherit", shell: useShell });
  return r.status ?? 1;
}

if (onRender) {
  console.log("[start] pushing prisma schema to database...");
  // npx resolves to npx.cmd on Windows — needs a shell.
  const push = run("npx", ["prisma", "db", "push"], true);
  if (push !== 0) {
    console.error("[start] prisma db push failed — refusing to boot with missing tables");
    process.exit(push);
  }
}

// execPath may contain spaces (e.g. "C:\Program Files\...") — spawn it
// directly without a shell so no quoting issues arise on any platform.
const code = run(process.execPath, ["dist/index.js"], false);
process.exit(code);
