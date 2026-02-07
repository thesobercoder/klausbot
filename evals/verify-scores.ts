/**
 * Verify eval scores meet minimum thresholds.
 *
 * Thin wrapper around evalite — runs all eval suites and relies on
 * evalite's built-in scoreThreshold (configured in evalite.config.ts)
 * to set exit code non-zero when any scorer average falls below threshold.
 *
 * Usage: npm run eval:verify
 */

import { execSync } from "child_process";

try {
  execSync("npx evalite", {
    stdio: "inherit",
    env: { ...process.env },
  });
  console.log("\nAll eval scores meet threshold.");
} catch {
  console.error("\nSome eval scores are below threshold.");
  process.exit(1);
}
