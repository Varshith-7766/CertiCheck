#!/usr/bin/env node
/**
 * Select the Prisma schema for this environment.
 *
 * Local dev keeps `prisma/schema.prisma` (SQLite) untouched.
 * On Render (`RENDER=true` is set automatically by the platform) or when
 * `NODE_ENV=production`, the Postgres variant is copied over
 * `prisma/schema.prisma` so that every plain `prisma ...` command
 * (generate, db push) just works without `--schema` flags or
 * dashboard-specific build commands.
 *
 * Render does a fresh clone per deploy, so overwriting the file there is safe.
 */
import { copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");

const onRender = process.env.RENDER === "true" || process.env.NODE_ENV === "production";

if (onRender) {
  copyFileSync(
    path.join(backendDir, "prisma", "schema.postgresql.prisma"),
    path.join(backendDir, "prisma", "schema.prisma")
  );
  console.log("[prisma] using postgres schema (production)");
} else {
  console.log("[prisma] using default sqlite schema (local dev)");
}
