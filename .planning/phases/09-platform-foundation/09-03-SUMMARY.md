---
phase: 09-platform-foundation
plan: 03
subsystem: config
tags: [zod, 12-factor, hot-reload, validation, cli]

# Dependency graph
requires:
  - phase: 09-01
    provides: Platform detection for config path resolution
provides:
  - Split config schemas (env vs JSON)
  - JSON config loader with mtime-based hot reload
  - Config validation CLI command
affects: [10-doctor, 11-onboard, service-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "12-factor config: secrets in env, non-secrets in JSON"
    - "Hot reload via mtime checking"
    - "Strict schema validation (unknown keys fail)"

key-files:
  created:
    - src/config/json.ts
    - src/cli/config.ts
  modified:
    - src/config/schema.ts
    - src/config/index.ts
    - src/index.ts

key-decisions:
  - "Strict mode on JSON schema - unknown keys cause validation failure"
  - "mtime-based caching for hot reload (cheap to call frequently)"
  - "Backward compatibility via configSchema/Config exports"

patterns-established:
  - "Config separation: TELEGRAM_BOT_TOKEN/OPENAI_API_KEY in env, model/preferences in JSON"
  - "getJsonConfig() safe for frequent calls (mtime check)"

# Metrics
duration: 2m 44s
completed: 2026-01-31
---

# Phase 09 Plan 03: Config Validation Summary

**12-factor compliant config with env/JSON separation, mtime hot reload, and `klausbot config validate` command**

## Performance

- **Duration:** 2m 44s
- **Started:** 2026-01-31T13:35:48Z
- **Completed:** 2026-01-31T13:38:32Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Split config schemas: `envSchema` (secrets) and `jsonConfigSchema` (non-secrets)
- JSON config loader with mtime-based hot reload from `~/.klausbot/config/klausbot.json`
- Strict mode validation - unknown keys in JSON config cause startup failure
- `klausbot config validate` CLI command showing env and JSON config status

## Task Commits

Each task was committed atomically:

1. **Task 1: Update config schemas for separation** - `7caa04c` (feat)
2. **Task 2: Create JSON config loader with hot reload** - `cc3b4d0` (feat)
3. **Task 3: Create config validate CLI command** - `fc63b62` (feat)

## Files Created/Modified

- `src/config/schema.ts` - Split into envSchema + jsonConfigSchema with strict mode
- `src/config/json.ts` - JSON config loader with mtime cache for hot reload
- `src/config/index.ts` - Re-exports for all config functions
- `src/cli/config.ts` - Config validation CLI command
- `src/index.ts` - Wire up `config validate` subcommand

## Decisions Made

- **Strict mode on JSON schema:** Unknown keys cause validation failure (explicit over permissive)
- **mtime-based caching:** `getJsonConfig()` checks file mtime before returning cache - cheap to call frequently
- **Backward compatibility:** Existing code importing `configSchema`/`Config` continues to work unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error with nested object defaults**

- **Found during:** Task 1 (schema update)
- **Issue:** `.default({})` on nested object with `.default('en')` child caused TypeScript error - empty object missing required `language` property
- **Fix:** Changed to `.default({ language: 'en' })` to satisfy TypeScript
- **Files modified:** src/config/schema.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 7caa04c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minor TypeScript fix required. No scope creep.

## Issues Encountered

None - plan executed as specified with one minor TypeScript adjustment.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Config validation foundation ready for doctor command integration
- JSON config path established for onboarding wizard
- Hot reload ready for service management config changes

---

_Phase: 09-platform-foundation_
_Completed: 2026-01-31_
