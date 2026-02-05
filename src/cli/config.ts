/**
 * Config validation CLI command
 *
 * Validates environment variables and JSON config file
 */

import { existsSync, readFileSync } from "fs";
import { theme } from "./theme.js";
import { envSchema, jsonConfigSchema } from "../config/schema.js";
import { JSON_CONFIG_PATH } from "../config/json.js";

/**
 * Run config validation
 *
 * Checks:
 * 1. Environment variables against envSchema
 * 2. JSON config file (if exists) against jsonConfigSchema
 *
 * Exits with code 1 if env validation fails
 */
export function runConfigValidate(): void {
  theme.blank();
  theme.header("Config Validation");
  theme.blank();

  // 1. Validate environment variables
  theme.muted("Checking environment variables...");
  const envResult = envSchema.safeParse(process.env);

  if (envResult.success) {
    theme.success("Environment variables: valid");
  } else {
    theme.error("Environment variables: invalid");
    for (const issue of envResult.error.issues) {
      theme.muted(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
  }

  theme.blank();

  // 2. Validate JSON config
  theme.muted(`Checking config file: ${JSON_CONFIG_PATH}`);

  if (!existsSync(JSON_CONFIG_PATH)) {
    theme.info("Config file not found (using defaults)");
  } else {
    try {
      const raw = readFileSync(JSON_CONFIG_PATH, "utf8");
      const parsed = JSON.parse(raw);
      const configResult = jsonConfigSchema.safeParse(parsed);

      if (configResult.success) {
        theme.success("Config file: valid");
      } else {
        theme.error("Config file: invalid");
        for (const issue of configResult.error.issues) {
          theme.muted(`  - ${issue.path.join(".")}: ${issue.message}`);
        }
      }
    } catch (err) {
      theme.error("Config file: parse error");
      theme.muted(`  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  theme.blank();

  // Exit with error if env validation failed
  if (!envResult.success) {
    // Use setImmediate to allow logger to flush before exit
    setTimeout(() => process.exit(1), 100);
  }
}
