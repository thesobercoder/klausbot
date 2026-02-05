---
phase: "07"
plan: "02"
subsystem: skills
tags: [skills, cli, refactor, retry, network]
dependency-graph:
  requires: ["07-01"]
  provides: ["skills-cleanup", "github-retry"]
  affects: []
tech-stack:
  added: []
  patterns: ["separation-of-concerns", "exponential-backoff"]
key-files:
  created: []
  modified:
    - src/cli/skills.ts
    - src/cli/index.ts
    - src/cli/install.ts
    - src/daemon/gateway.ts
    - src/index.ts
decisions:
  - "Skills CLI removed - management via npx skills or manual"
  - "skill-creator installed during wizard, not gateway startup"
  - "GitHub fetch calls use withRetry (3 retries, 1s base delay)"
metrics:
  duration: "~3 min"
  completed: "2026-01-30"
---

# Phase 7 Plan 2: Skills Cleanup Summary

Skills system cleaned up with separation of concerns and network resilience.

## What Changed

### 1. skills.ts Refactored

**Removed:**

- `REGISTRY` constant and `RegistrySkill` interface
- `browseSkills()`, `runSkillsCLI()`, `checkForUpdate()`
- `getInstalledHash()`, `formatChoice()`, `getInstalledSkills()`
- Inquirer imports (select, search, confirm)

**Added:**

- `withRetry` wrapper on all 4 GitHub fetch calls
- Retry config: 3 attempts, 1000ms base delay (exponential)

**Result:** 260 lines -> 106 lines, exports only `ensureSkillCreator`

### 2. Separation of Concerns

- **Gateway:** No longer installs skill-creator (removed import + call)
- **Install Wizard:** Now installs skill-creator at end of setup
- Non-fatal error handling - network failure doesn't block install

### 3. CLI Routing Updated

- Removed `case 'skills'` from index.ts dispatcher
- Updated help text with note: "Skills: npx skills or manually add to ~/.claude/skills/"
- Updated cli/index.ts exports (removed browseSkills, runSkillsCLI)

## Commits

| Commit  | Description                                                |
| ------- | ---------------------------------------------------------- |
| 143399e | Clean up skills.ts - remove registry and CLI, add retry    |
| e33e111 | Move skill-creator install from gateway to wizard          |
| 32183fe | Remove skills CLI routing, update help with external tools |

## Verification

- [x] `npm run build` succeeds
- [x] `klausbot help` shows "Skills: npx skills..." note
- [x] `klausbot skills` returns "Unknown command" error
- [x] `grep ensureSkillCreator src/daemon/` returns nothing
- [x] `grep ensureSkillCreator src/cli/install.ts` shows the call
- [x] skills.ts imports withRetry and wraps all fetch calls

## Deviations from Plan

None - plan executed exactly as written.

## Architecture Notes

**Before:**

```
Gateway startup
  -> ensureSkillCreator()
  -> skills.ts has full CLI (260 lines)
  -> klausbot skills [browse] command
```

**After:**

```
Install wizard
  -> ensureSkillCreator() at end
  -> skills.ts minimal (106 lines, retry only)
  -> Skills: npx skills (external)
```

## Next Phase Readiness

Ready for 07-03 (MCP Logging) and 07-04 (Agent Authoring). Skills system cleaned up.
