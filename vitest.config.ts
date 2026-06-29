import { defineConfig } from "vitest/config";

// Unit tests cover the pure domain core only (lib/*.test.ts). Everything else
// (routes, actions, components) is verified end-to-end on workerd.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
