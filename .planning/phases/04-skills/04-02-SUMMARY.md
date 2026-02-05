---
phase: 04-skills
plan: 02
subsystem: cli
tags: [skills, github-api, cli, auto-install]

dependency_graph:
  requires: []
  provides: [skills-cli, skill-auto-installer]
  affects: [04-03]

tech_stack:
  added: []
  patterns: [recursive-github-fetch, auto-install-on-startup]

key_files:
  created:
    - src/cli/skills.ts
  modified:
    - src/cli/index.ts
    - src/index.ts
    - src/daemon/gateway.ts
    - src/telegram/skills.ts
    - src/telegram/index.ts

decisions:
  - id: "04-02-01"
    choice: "GitHub API for skill download"
    rationale: "Recursive fetch to get entire skill folder with all accompanying files"

metrics:
  duration: "2 min"
  completed: "2026-01-29"
---

# Phase 04 Plan 02: Skills CLI Summary

**One-liner:** GitHub API recursive installer for skills with auto-install on gateway startup.

## What Was Built

### Skills CLI (`src/cli/skills.ts`)

- `ensureSkillCreator()` - auto-installs skill-creator if missing
- `runSkillsCLI()` - interactive menu to install curated skills
- `installSkillFolder()` - recursive GitHub API download (handles subdirs)
- `getInstalledSkills()` - lists installed skills from `~/.claude/skills/`

### CLI Integration

- Added `klausbot skills` command to main CLI
- Exports from `src/cli/index.ts`: `runSkillsCLI`, `ensureSkillCreator`

### Gateway Integration

- `ensureSkillCreator()` called on gateway startup
- `registerSkillCommands()` registers skills in Telegram menu

## Commits

| Hash    | Type | Description                       |
| ------- | ---- | --------------------------------- |
| 9055422 | feat | Create skills CLI module          |
| bc36f3b | feat | Wire CLI and gateway auto-install |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BotCommand type import error**

- **Found during:** Task 1 verification
- **Issue:** `src/telegram/skills.ts` imported non-existent `BotCommand` from grammy
- **Fix:** Defined local `BotCommand` interface
- **Files modified:** `src/telegram/skills.ts`
- **Commit:** 9055422

## Verification Results

| Check                        | Status                                 |
| ---------------------------- | -------------------------------------- |
| `npx tsc --noEmit`           | PASS                                   |
| `klausbot skills` shows menu | PASS                                   |
| skill-creator auto-installed | PASS                                   |
| Full folder with all files   | PASS (SKILL.md, references/, scripts/) |

## Key Technical Details

### GitHub API Recursive Download

```typescript
// Fetches folder contents from GitHub API
const res = await fetch(`${GITHUB_API}/${name}`);
const contents = await res.json() as GitHubContentItem[];

// Downloads files directly, recurses into directories
for (const item of contents) {
  if (item.type === 'file') { /* download */ }
  else if (item.type === 'dir') { await installSubdir(...) }
}
```

### Auto-install Flow

1. Gateway starts
2. `ensureSkillCreator()` checks `~/.claude/skills/skill-creator/SKILL.md`
3. If missing, downloads entire folder from GitHub
4. `registerSkillCommands()` adds skills to Telegram menu

## Next Phase Readiness

Ready for 04-03 (skill invocation):

- Skills installed to `~/.claude/skills/`
- Full folder structure preserved (SKILL.md, references/, scripts/)
- `getInstalledSkillNames()` available for listing
