/**
 * Startup checklist display for klausbot.
 *
 * Shows color-coded capability status at startup.
 * Validates required capabilities before proceeding.
 */

import { theme } from "../cli/theme.js";
import { detectPlatform } from "./detect.js";
import {
  capabilities,
  checkAllCapabilities,
  type CheckResult,
} from "./capabilities.js";

/**
 * Display the startup checklist with color-coded capability status.
 *
 * @param results Array of CheckResult from checkAllCapabilities()
 */
export function displayStartupChecklist(results: CheckResult[]): void {
  const platform = detectPlatform();

  theme.header("Capability Check");
  theme.blank();

  // Show platform info
  theme.muted(`  Platform: ${platform.displayName}`);
  theme.muted(`  Node:     ${platform.nodeVersion}`);
  theme.blank();

  // Track counts
  let enabledCount = 0;
  const totalCount = results.length;
  const missingHints: string[] = [];

  // Display each capability
  for (const result of results) {
    const { capability, status } = result;
    const { name, severity, hint } = capability;

    if (status === "ok") {
      // Green checkmark for OK
      console.log(
        `  ${theme.colors.green(theme.symbols.check)} ${name}: ${theme.colors.green("enabled")}`,
      );
      enabledCount++;
    } else if (severity === "required") {
      // Red X for missing required
      console.log(
        `  ${theme.colors.red(theme.symbols.cross)} ${name}: ${theme.colors.red("disabled")}`,
      );
      missingHints.push(hint);
    } else {
      // Yellow warning for missing optional
      console.log(
        `  ${theme.colors.yellow(theme.symbols.warning)}  ${name}: ${theme.colors.yellow("degraded")}`,
      );
      missingHints.push(hint);
    }
  }

  // Summary line
  theme.blank();
  const summaryColor =
    enabledCount === totalCount
      ? theme.colors.green
      : enabledCount >=
          capabilities.filter((c) => c.severity === "required").length
        ? theme.colors.yellow
        : theme.colors.red;

  console.log(
    `  ${summaryColor(`Ready: ${enabledCount}/${totalCount} features enabled`)}`,
  );

  // Hints section for missing capabilities
  if (missingHints.length > 0) {
    theme.blank();
    theme.muted("  To enable more features:");
    for (const hint of missingHints) {
      theme.muted(`    ${theme.symbols.arrow} ${hint}`);
    }
  }

  theme.blank();
}

/**
 * Validate required capabilities and exit if any are missing.
 *
 * Shows the startup checklist, then exits with error if required capabilities
 * are not available.
 */
export async function validateRequiredCapabilities(): Promise<void> {
  const results = await checkAllCapabilities();

  // Display the checklist
  displayStartupChecklist(results);

  // Find missing required capabilities
  const missingRequired = results.filter(
    (r) => r.status === "missing" && r.capability.severity === "required",
  );

  if (missingRequired.length > 0) {
    const names = missingRequired.map((r) => r.capability.name).join(", ");
    theme.error(`Missing required capabilities: ${names}`);
    theme.blank();
    theme.muted("  Run `klausbot doctor` for detailed diagnostics");
    theme.blank();
    // Use setImmediate to allow pino logger to flush before exit
    setTimeout(() => process.exit(1), 100);
    // Return a never-resolving promise to prevent further execution
    await new Promise(() => {});
  }
}
