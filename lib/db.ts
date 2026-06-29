import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/db/schema";

// Drizzle client bound to the D1 instance for the current request.
// Works in route handlers and server components during a request, and in
// `next dev` via initOpenNextCloudflareForDev() (see next.config.ts).
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}
