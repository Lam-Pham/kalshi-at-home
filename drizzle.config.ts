import { defineConfig } from "drizzle-kit";

// We only use drizzle-kit to GENERATE migration SQL. Migrations are APPLIED
// with wrangler (`wrangler d1 migrations apply kalshi-friends-db [--local]`),
// which is why `out` matches the `migrations_dir` in wrangler.jsonc.
export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema.ts",
  out: "./drizzle/migrations",
});
