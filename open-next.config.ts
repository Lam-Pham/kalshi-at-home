import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config for v1 — no ISR/incremental cache (no R2 bucket) at friends scale.
// Add an incremental-cache override here later if we ever need ISR.
export default defineCloudflareConfig({});
