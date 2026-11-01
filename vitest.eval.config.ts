import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The corpus evaluation is slow and writes corpus/REPORT.md, so it runs on its own: npm run eval.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/eval/**/*.test.ts"], environment: "node", testTimeout: 600_000 },
});
