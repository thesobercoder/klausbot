# Phase 9: Platform Foundation - Research

**Researched:** 2026-01-31
**Domain:** Platform detection, capability checking, 12-factor configuration
**Confidence:** HIGH

## Summary

Phase 9 implements reliable environment detection and startup diagnostics for klausbot across macOS, Linux, and WSL2. The codebase already has good foundations: Zod for config validation, picocolors for themed output, and commander.js for CLI.

Key technical domains:

1. **Platform detection** via Node.js `os` module (no external deps needed)
2. **WSL2 detection** via kernel release string check (no `is-wsl` needed)
3. **Claude Code detection** via `claude auth status` subprocess
4. **Config separation**: env vars (secrets) + JSON file (non-secrets)
5. **Startup checklist** via existing theme module with status symbols

**Primary recommendation:** Extend existing infrastructure. No new dependencies required.

## Standard Stack

The codebase already has everything needed. No new packages.

### Core (Already Installed)

| Library    | Version | Purpose           | Why Standard                                    |
| ---------- | ------- | ----------------- | ----------------------------------------------- |
| zod        | ^4.3.6  | Schema validation | Already used for config; extends to JSON config |
| picocolors | ^1.1.1  | Terminal colors   | Already used by theme module                    |
| commander  | ^14.0.2 | CLI framework     | Already used; add `doctor`, `config validate`   |
| dotenv     | ^16.4.7 | Env loading       | Already used at startup                         |

### Alternatives Considered

| Instead of     | Could Use      | Tradeoff                                                       |
| -------------- | -------------- | -------------------------------------------------------------- |
| is-wsl         | Manual check   | Avoid dep for 5-line check; is-wsl has is-inside-container dep |
| command-exists | execSync which | Already pattern in install.ts; no need for dep                 |
| convict        | zod            | Already using zod; convict adds concepts                       |

**Installation:**

```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── platform/              # NEW: Platform detection module
│   ├── index.ts           # Re-exports
│   ├── detect.ts          # OS, WSL detection
│   ├── capabilities.ts    # Capability checker
│   └── startup.ts         # Startup checklist display
├── config/                # EXTEND: Add JSON config support
│   ├── index.ts           # Existing
│   ├── schema.ts          # EXTEND: Add JSON config schema
│   ├── loader.ts          # EXTEND: Load both env + JSON
│   └── validate.ts        # NEW: CLI validation command
```

### Pattern 1: Platform Detection

**What:** Pure Node.js platform detection without external dependencies
**When to use:** Any platform-specific behavior
**Example:**

```typescript
// Source: https://nodejs.org/api/os.html
import os from "node:os";
import { readFileSync } from "fs";

export type Platform = "macos" | "linux" | "wsl2" | "unsupported";

export function detectPlatform(): Platform {
  const platform = os.platform();

  if (platform === "darwin") return "macos";

  if (platform === "linux") {
    // Check for WSL2 via kernel release
    // Source: https://github.com/sindresorhus/is-wsl implementation
    const release = os.release().toLowerCase();
    if (release.includes("microsoft")) return "wsl2";

    // Fallback: check /proc/version
    try {
      const procVersion = readFileSync("/proc/version", "utf8").toLowerCase();
      if (procVersion.includes("microsoft")) return "wsl2";
    } catch {
      /* not WSL */
    }

    return "linux";
  }

  return "unsupported";
}
```

### Pattern 2: Capability Checker

**What:** Structured capability detection with severity levels
**When to use:** Startup checks
**Example:**

```typescript
export type Severity = "required" | "optional" | "info";
export type Status = "ok" | "degraded" | "missing";

export interface Capability {
  name: string;
  severity: Severity;
  check: () => Promise<Status> | Status;
  hint?: string; // Shown when not ok
}

export interface CheckResult {
  capability: Capability;
  status: Status;
  message?: string;
}

export const CAPABILITIES: Capability[] = [
  {
    name: "Telegram Bot Token",
    severity: "required",
    check: () => (process.env.TELEGRAM_BOT_TOKEN ? "ok" : "missing"),
    hint: "Set TELEGRAM_BOT_TOKEN in .env",
  },
  {
    name: "Claude Code",
    severity: "required",
    check: async () => {
      try {
        execSync("claude auth status", { stdio: "pipe" });
        return "ok";
      } catch {
        return "missing";
      }
    },
    hint: "Run: claude auth login",
  },
  {
    name: "OpenAI API (Embeddings)",
    severity: "optional",
    check: () => (process.env.OPENAI_API_KEY ? "ok" : "missing"),
    hint: "Set OPENAI_API_KEY for memory search",
  },
];
```

### Pattern 3: Config Separation (12-Factor)

**What:** Secrets in env vars, non-secrets in JSON config
**When to use:** All configuration loading
**Example:**

```typescript
// Env schema - secrets only (existing pattern extended)
export const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  LOG_LEVEL: z
    .enum(["silent", "trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});

// JSON config schema - non-secrets
export const configSchema = z
  .object({
    model: z.string().default("claude-3-5-sonnet-20241022"),
    logVerbosity: z.enum(["minimal", "normal", "verbose"]).default("normal"),
    preferences: z
      .object({
        timezone: z.string().optional(),
        language: z.string().default("en"),
      })
      .default({}),
  })
  .strict(); // Fail on unknown keys
```

### Pattern 4: Startup Checklist Display

**What:** Verbose capability display at startup
**When to use:** daemon start, doctor command
**Example:**

```typescript
import { theme } from "../cli/theme.js";

function displayStartupChecklist(results: CheckResult[]): void {
  theme.blank();
  theme.header("Capability Check");
  theme.blank();

  let enabled = 0;
  const total = results.length;

  for (const { capability, status } of results) {
    const icon =
      status === "ok"
        ? theme.colors.green("\u2713")
        : status === "degraded"
          ? theme.colors.yellow("\u26A0")
          : theme.colors.red("\u2717");
    const name = capability.name;
    const statusText =
      status === "ok"
        ? "enabled"
        : status === "degraded"
          ? "degraded"
          : "disabled";

    console.log(`  ${icon} ${name}: ${statusText}`);

    if (status === "ok") enabled++;
  }

  theme.blank();
  theme.info(`Ready: ${enabled}/${total} features enabled`);

  // Show hints for missing/degraded
  const hints = results.filter((r) => r.status !== "ok" && r.capability.hint);
  if (hints.length > 0) {
    theme.blank();
    theme.muted("To enable more features:");
    for (const { capability } of hints) {
      theme.muted(`  - ${capability.hint}`);
    }
  }
}
```

### Pattern 5: Config Hot Reload

**What:** Reload config on file change without restart
**When to use:** JSON config changes
**Example:**

```typescript
import { watch } from "fs";

let configCache: Config | null = null;
let configMtime: number = 0;

export function loadConfig(): Config {
  const stats = statSync(CONFIG_PATH);
  if (configCache && stats.mtimeMs === configMtime) {
    return configCache;
  }

  const raw = readFileSync(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const validated = configSchema.parse(parsed);

  configCache = validated;
  configMtime = stats.mtimeMs;
  return validated;
}

// Check for updates on each message (cheap mtime check)
export function getConfig(): Config {
  return loadConfig(); // Checks mtime, returns cache if unchanged
}
```

### Anti-Patterns to Avoid

- **Env var groups**: Don't create "environments" like `NODE_ENV=staging` that change behavior. Each var independent.
- **Hardcoded secrets**: Never default secrets. Fail if missing.
- **Swallowing errors**: Config errors should fail startup, not log and continue.
- **Blocking async checks**: Claude Code auth check is async; don't block startup for optional features.

## Don't Hand-Roll

| Problem            | Don't Build         | Use Instead                     | Why                           |
| ------------------ | ------------------- | ------------------------------- | ----------------------------- |
| Platform detection | Complex OS sniffing | `os.platform()` + release check | 5 lines, no deps              |
| Config validation  | Manual parsing      | Zod `.strict()` mode            | Already in codebase           |
| Terminal colors    | ANSI codes          | picocolors                      | Already in codebase           |
| Command existence  | PATH walking        | `execSync('which X')`           | Already pattern in install.ts |

**Key insight:** The codebase already has all needed tools. Phase 9 is assembly, not invention.

## Common Pitfalls

### Pitfall 1: WSL2 Detection in Containers

**What goes wrong:** Docker on WSL2 shows "microsoft" in kernel string but isn't actually WSL2
**Why it happens:** WSL2 kernel leaks through to Docker containers
**How to avoid:** Check for container environment first (/.dockerenv or cgroup)
**Warning signs:** Different behavior in Docker vs native WSL2

```typescript
function isWSL2(): boolean {
  if (os.platform() !== "linux") return false;

  // Check if in container first
  if (existsSync("/.dockerenv")) return false;

  return os.release().toLowerCase().includes("microsoft");
}
```

### Pitfall 2: Claude Code Auth Status Hanging

**What goes wrong:** `claude auth status` blocks for network request
**Why it happens:** Claude CLI may try to verify auth with server
**How to avoid:** Use timeout, don't block startup
**Warning signs:** Slow startup on poor network

```typescript
async function checkClaudeAuth(): Promise<boolean> {
  try {
    execSync("claude auth status", {
      stdio: "pipe",
      timeout: 5000, // 5 second timeout
    });
    return true;
  } catch {
    return false;
  }
}
```

### Pitfall 3: JSON Config Syntax Errors at Runtime

**What goes wrong:** User edits config.json, typo breaks startup
**Why it happens:** JSON is unforgiving; trailing commas, quotes, etc.
**How to avoid:** Pre-start validation command, clear error messages
**Warning signs:** App crashes with "Unexpected token" on startup

### Pitfall 4: execPath in Development vs Production

**What goes wrong:** `process.execPath` returns node, not klausbot binary
**Why it happens:** In dev, running via `tsx src/index.ts`; in prod, via compiled binary
**How to avoid:** Use `process.argv[1]` for script path, not execPath
**Warning signs:** Self-referencing commands fail in dev

```typescript
// Correct pattern for self-invocation
const nodeExec = process.argv[0]; // node/tsx executable
const scriptPath = process.argv[1]; // script being run
const selfCommand = `"${nodeExec}" "${scriptPath}"`;
```

### Pitfall 5: Config Reload Race Conditions

**What goes wrong:** Config reloads mid-message, inconsistent state
**Why it happens:** Hot reload during processing
**How to avoid:** Only reload between messages, not during
**Warning signs:** Inconsistent behavior, partial config states

## Code Examples

### Complete Platform Detection Module

```typescript
// src/platform/detect.ts
import os from "node:os";
import { existsSync, readFileSync } from "fs";

export type Platform = "macos" | "linux" | "wsl2" | "unsupported";

export interface PlatformInfo {
  platform: Platform;
  displayName: string;
  isWSL: boolean;
  arch: string;
  nodeVersion: string;
}

export function detectPlatform(): PlatformInfo {
  const osPlat = os.platform();
  const arch = os.arch();
  const nodeVersion = process.version;

  let platform: Platform;
  let displayName: string;
  let isWSL = false;

  if (osPlat === "darwin") {
    platform = "macos";
    displayName = `macOS (${arch === "arm64" ? "Apple Silicon" : "Intel"})`;
  } else if (osPlat === "linux") {
    // WSL2 detection
    if (!existsSync("/.dockerenv")) {
      const release = os.release().toLowerCase();
      if (release.includes("microsoft")) {
        isWSL = true;
      } else {
        try {
          const procVer = readFileSync("/proc/version", "utf8").toLowerCase();
          isWSL = procVer.includes("microsoft");
        } catch {
          /* not WSL */
        }
      }
    }

    platform = isWSL ? "wsl2" : "linux";
    displayName = isWSL ? "Linux (WSL2)" : "Linux";
  } else {
    platform = "unsupported";
    displayName = `Unsupported (${osPlat})`;
  }

  return { platform, displayName, isWSL, arch, nodeVersion };
}
```

### Complete Capability Check System

```typescript
// src/platform/capabilities.ts
import { execSync } from "child_process";

export type Severity = "required" | "optional";
export type Status = "ok" | "missing";

export interface Capability {
  id: string;
  name: string;
  severity: Severity;
  check: () => Promise<Status> | Status;
  hint: string;
}

export const capabilities: Capability[] = [
  {
    id: "telegram",
    name: "Telegram Bot Token",
    severity: "required",
    check: () => (process.env.TELEGRAM_BOT_TOKEN ? "ok" : "missing"),
    hint: "Set TELEGRAM_BOT_TOKEN in environment or .env file",
  },
  {
    id: "claude",
    name: "Claude Code",
    severity: "required",
    check: () => {
      try {
        execSync("claude auth status", { stdio: "pipe", timeout: 5000 });
        return "ok";
      } catch {
        return "missing";
      }
    },
    hint: "Run: claude auth login",
  },
  {
    id: "openai",
    name: "OpenAI API (search_memory)",
    severity: "optional",
    check: () => (process.env.OPENAI_API_KEY ? "ok" : "missing"),
    hint: "Set OPENAI_API_KEY for semantic memory search",
  },
];

export async function checkAllCapabilities(): Promise<Map<string, Status>> {
  const results = new Map<string, Status>();

  for (const cap of capabilities) {
    const status = await cap.check();
    results.set(cap.id, status);
  }

  return results;
}
```

### CLI Doctor Command

```typescript
// src/cli/doctor.ts
import { theme } from "./theme.js";
import { detectPlatform } from "../platform/detect.js";
import {
  capabilities,
  checkAllCapabilities,
  Status,
} from "../platform/capabilities.js";

export async function runDoctor(): Promise<void> {
  const platform = detectPlatform();

  theme.blank();
  theme.header("klausbot doctor");
  theme.blank();

  // Platform info
  theme.keyValue("Platform", platform.displayName);
  theme.keyValue("Node", platform.nodeVersion);
  theme.blank();

  // Capability checks
  theme.muted("Checking capabilities...");
  theme.blank();

  const results = await checkAllCapabilities();
  let hasRequired = true;

  for (const cap of capabilities) {
    const status = results.get(cap.id) ?? "missing";
    const icon =
      status === "ok"
        ? theme.colors.green("\u2713")
        : theme.colors.red("\u2717");
    const label = `${cap.name} (${cap.severity})`;

    console.log(`  ${icon} ${label}`);

    if (status !== "ok") {
      theme.muted(`    ${cap.hint}`);
      if (cap.severity === "required") hasRequired = false;
    }
  }

  theme.blank();

  if (hasRequired) {
    theme.success("All required capabilities available");
  } else {
    theme.error("Missing required capabilities - klausbot cannot start");
    process.exit(1);
  }
}
```

### Config Validation Command

```typescript
// src/cli/config-validate.ts
import { existsSync, readFileSync } from "fs";
import { theme } from "./theme.js";
import { envSchema, configSchema } from "../config/schema.js";

const CONFIG_PATH = `${process.env.HOME}/.klausbot/config/klausbot.json`;

export function runConfigValidate(): void {
  theme.blank();
  theme.header("Config Validation");
  theme.blank();

  // Validate env vars
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

  // Validate JSON config (if exists)
  theme.muted("Checking config file...");

  if (!existsSync(CONFIG_PATH)) {
    theme.info(`Config file not found: ${CONFIG_PATH}`);
    theme.muted("  Using defaults");
  } else {
    try {
      const raw = readFileSync(CONFIG_PATH, "utf8");
      const parsed = JSON.parse(raw);
      const configResult = configSchema.safeParse(parsed);

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
}
```

## State of the Art

| Old Approach          | Current Approach   | When Changed | Impact              |
| --------------------- | ------------------ | ------------ | ------------------- |
| is-wsl package        | os.release() check | 2024+        | Fewer deps, simpler |
| chalk                 | picocolors         | 2023+        | Smaller, faster     |
| Manual env validation | Zod schemas        | 2022+        | Type-safe config    |

**Deprecated/outdated:**

- `os.type()` for WSL: Use `os.release()` instead; type() returns "Linux" for WSL
- Synchronous file watching: Use mtime checks instead of fs.watch (unreliable cross-platform)

## Open Questions

1. **Claude Code auth without network**
   - What we know: `claude auth status` works offline if already authed
   - What's unclear: Exact timeout behavior, error messages
   - Recommendation: 5-second timeout, treat timeout as "unknown"

2. **Config file location precedence**
   - What we know: `~/.klausbot/config/` is the home
   - What's unclear: Should local ./config.json override?
   - Recommendation: Only `~/.klausbot/config/klausbot.json`, no local override (12-factor)

## Sources

### Primary (HIGH confidence)

- Node.js Process API: https://nodejs.org/api/process.html
- Node.js OS API: https://nodejs.org/api/os.html
- is-wsl implementation: https://github.com/sindresorhus/is-wsl

### Secondary (MEDIUM confidence)

- 12-Factor Config: https://12factor.net/config
- Zod env validation patterns: https://douglasmoura.dev/en-US/validate-your-environment-variables-with-zod
- Claude Code CLI: https://code.claude.com/docs/en/cli-reference

### Tertiary (LOW confidence)

- WebSearch results for patterns (2026 dated)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - using existing codebase packages
- Architecture: HIGH - extending existing patterns
- Platform detection: HIGH - Node.js official APIs
- Pitfalls: MEDIUM - some based on WebSearch, some from codebase analysis

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days - stable domain)
