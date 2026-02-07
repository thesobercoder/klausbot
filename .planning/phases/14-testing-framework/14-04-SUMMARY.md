---
phase: 14-testing-framework
plan: 04
subsystem: evals
tags: [evalite, ai-sdk, llm-judge, eval-suite, anthropic]
depends_on: [14-01]
provides:
  - Evalite eval suite with 11 test cases across 3 domains
  - Custom LLM-judge and deterministic scorers
  - Shared model wrapper and prompt builder helpers
affects: []
tech-stack:
  added: [evalite@1.0.0-beta.15, ai@6.0.75, "@ai-sdk/anthropic@3.0.38"]
  patterns:
    [LLM-as-judge scoring, evalite eval framework, AI SDK model wrapping]
key-files:
  created:
    - evalite.config.ts
    - evals/helpers/model.ts
    - evals/helpers/prompts.ts
    - evals/helpers/scorers.ts
    - evals/system-prompt.eval.ts
    - evals/heartbeat.eval.ts
    - evals/cron.eval.ts
  modified:
    - package.json
    - .gitignore
key-decisions:
  - evalite/ai-sdk for wrapAISDKModel import, evalite/config for defineConfig
  - --legacy-peer-deps for evalite install (better-sqlite3 v12 vs v11 peer conflict)
  - Placeholder identity content in eval prompts (not real identity files)
  - Pipe-delimited input encoding for cron eval (jobName|instruction)
duration: 6m 32s
completed: 2026-02-07
---

# Phase 14 Plan 04: Evalite Eval Suite Summary

Evalite eval suite testing klausbot LLM behavior: system prompt personality, heartbeat HEARTBEAT_OK suppression, cron output substantiveness via AI SDK + Claude Sonnet judge.

## Performance

- Duration: 6m 32s
- Tasks: 2/2 complete
- All checks pass (format, lint, typecheck, unit tests)

## Accomplishments

1. **Evalite infrastructure**: Installed evalite@beta with AI SDK and Anthropic provider. Created evalite.config.ts, npm eval/eval:watch scripts.
2. **Shared helpers**: Model wrapper (taskModel + judgeModel via wrapAISDKModel), prompt builders reconstructing production prompt structures without src/ side effects.
3. **4 custom scorers**: behavior-match (LLM judge), exact-match, not-exact-match, substantiveness (LLM judge). All return 0-1 scores with metadata.
4. **11 eval cases across 3 suites**:
   - System Prompt Behavior (5): casual greeting, capabilities, memory, deflection, style change
   - Heartbeat (3): 2 HEARTBEAT_OK suppression, 1 actionable item reporting
   - Cron Output Quality (3): weather summary, news digest, reminder check

## Task Commits

| Task | Name                                      | Commit  | Key Files                                                                                          |
| ---- | ----------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| 1    | Install Evalite + config + shared helpers | aab52f3 | package.json, evalite.config.ts, evals/helpers/model.ts, evals/helpers/prompts.ts                  |
| 2    | Create eval suites + scorers              | 9e8b636 | evals/helpers/scorers.ts, evals/system-prompt.eval.ts, evals/heartbeat.eval.ts, evals/cron.eval.ts |

## Files Created

- `evalite.config.ts` — Evalite configuration (defineConfig)
- `evals/helpers/model.ts` — Wrapped AI SDK models (taskModel, judgeModel)
- `evals/helpers/prompts.ts` — Eval prompt builders (system, heartbeat, cron)
- `evals/helpers/scorers.ts` — Custom scorers (behavior-match, exact-match, not-exact-match, substantiveness)
- `evals/system-prompt.eval.ts` — System prompt personality/behavior eval (5 cases)
- `evals/heartbeat.eval.ts` — Heartbeat suppression/reporting eval (3 cases)
- `evals/cron.eval.ts` — Cron output quality eval (3 cases)

## Files Modified

- `package.json` — Added evalite, ai, @ai-sdk/anthropic devDeps; eval/eval:watch scripts
- `.gitignore` — Added .evalite/ for eval cache/results

## Decisions Made

1. **Import paths**: evalite/ai-sdk for wrapAISDKModel, evalite/config for defineConfig (not main evalite export)
2. **--legacy-peer-deps**: Required because project uses better-sqlite3@12.6.2 but evalite peer-wants ^11.6.0 (optional peer dep for internal storage, no functional conflict)
3. **Placeholder identity**: Eval prompts use placeholder SOUL.md/IDENTITY.md/USER.md content, testing prompt structure fidelity rather than specific identity file content
4. **Pipe-delimited cron input**: Cron eval encodes "jobName|instruction" in single input string, split in task function

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed evalite peer dependency conflict**

- **Found during:** Task 1
- **Issue:** evalite@beta requires better-sqlite3 ^11.6.0, project has 12.6.2
- **Fix:** Used --legacy-peer-deps (optional peer, no runtime conflict)
- **Commit:** aab52f3

**2. [Rule 3 - Blocking] Fixed syncpack semver range violations**

- **Found during:** Task 1
- **Issue:** npm installed @ai-sdk/anthropic, ai, evalite with ^ ranges; syncpack requires exact versions
- **Fix:** Removed ^ prefixes from all three devDependency versions
- **Commit:** aab52f3

**3. [Rule 3 - Blocking] Fixed evalite import paths**

- **Found during:** Task 2
- **Issue:** defineConfig not in main evalite export (need evalite/config); wrapAISDKModel not in main export (need evalite/ai-sdk)
- **Fix:** Updated import paths in evalite.config.ts and evals/helpers/model.ts
- **Commit:** 9e8b636

**4. [Rule 2 - Missing Critical] Added .evalite/ to .gitignore**

- **Found during:** Task 2
- **Issue:** Evalite creates .evalite/ directory for cache and results on first run; should not be committed
- **Fix:** Added .evalite/ to .gitignore
- **Commit:** 9e8b636

## Issues Encountered

None beyond the deviations above. All resolved without user intervention.

## Next Phase Readiness

Phase 14 (Testing Framework) is now complete:

- 14-01: Test infrastructure (vitest, coverage)
- 14-02: Memory module unit tests
- 14-03: Cron/heartbeat unit tests
- 14-04: Evalite eval suite (this plan)

To run evals: `ANTHROPIC_API_KEY=sk-... npm run eval`
To run with dashboard: `ANTHROPIC_API_KEY=sk-... npm run eval:watch`

v1.1 Production Ready milestone is complete pending STATE.md update.
