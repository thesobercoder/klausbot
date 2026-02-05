/**
 * Platform module - re-exports.
 *
 * Provides platform detection, capability checking, and startup validation.
 */

export {
  detectPlatform,
  isContainer,
  type Platform,
  type PlatformInfo,
} from "./detect.js";

export {
  capabilities,
  checkAllCapabilities,
  type Capability,
  type CheckResult,
  type Severity,
  type Status,
} from "./capabilities.js";

export {
  displayStartupChecklist,
  validateRequiredCapabilities,
} from "./startup.js";
