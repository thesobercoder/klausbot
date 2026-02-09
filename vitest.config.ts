import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/cli/**"],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 28,
        branches: 26,
        functions: 32,
        lines: 28,
      },
    },
  },
});
