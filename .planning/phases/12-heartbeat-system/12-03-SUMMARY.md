---
phase: 12-heartbeat-system
plan: 03
subsystem: heartbeat
tags: [heartbeat, notes, trigger-detection, natural-language]

depends:
  requires: [12-01-heartbeat-core]
  provides: [heartbeat-note-collection]
  affects: []

tech-stack:
  added: []
  patterns: [regex-trigger-detection, claude-instruction-injection]

key-files:
  created:
    - src/heartbeat/notes.ts
  modified:
    - src/heartbeat/index.ts
    - src/daemon/gateway.ts

decisions:
  - Trigger phrases use regex for flexible case-insensitive matching
  - Claude interprets intent and stores cleaned note (not verbatim)
  - Note collection skipped during bootstrap mode
  - Instructions appended via additionalInstructions pattern

metrics:
  duration: 1m 20s
  completed: 2026-02-05
---

# Phase 12 Plan 03: Heartbeat Note Collection Summary

Natural language trigger detection + gateway integration for users to add reminders to HEARTBEAT.md via conversation.

## What Was Built

### Notes Module (src/heartbeat/notes.ts)

- `TRIGGER_PHRASES`: Array of 7 regex patterns for common reminder phrases
  - "remind me", "don't forget", "check on", "remember to"
  - "heartbeat:", "add...reminder", "keep track of"
- `shouldCollectNote(text)`: Returns true if text matches any trigger
- `getNoteCollectionInstructions(text)`: Generates XML prompt block for Claude
  - References HEARTBEAT.md path from executor module
  - Instructs Claude to interpret intent, not store verbatim
  - Includes format guidance for checkboxes and expiry dates

### Module Index Update (src/heartbeat/index.ts)

Added export: `shouldCollectNote`, `getNoteCollectionInstructions`

### Gateway Integration (src/daemon/gateway.ts)

- Updated import to include note functions
- Added note collection check in `processMessage()`:
  - Skipped during bootstrap mode (identity files must exist first)
  - Appends note instructions to `additionalInstructions`
  - Logs when note collection is triggered

## Key Design Decisions

1. **Regex trigger detection**: Case-insensitive patterns for natural phrasing
2. **Claude interprets intent**: Stores cleaned/structured note, not verbatim text
3. **Bootstrap skip**: Note collection disabled until identity files exist
4. **Instruction injection**: Uses existing `additionalInstructions` pattern

## Commits

| Hash    | Type | Description                                               |
| ------- | ---- | --------------------------------------------------------- |
| 4ad71e0 | feat | create heartbeat notes module with trigger detection      |
| 322334c | feat | export notes functions from heartbeat module index        |
| 013f8eb | feat | integrate note collection into gateway message processing |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript: Compiles (no new errors from heartbeat changes)
- Notes module: notes.ts created with both exports
- Gateway: shouldCollectNote and noteInstructions logic present
- Index: Re-exports both note functions

## Next Steps

- Phase 12 complete (plans 01, 02, 03 all executed)
- Move to Phase 14 (Testing Framework) or other remaining work

---

_Plan: 12-03 | Completed: 2026-02-05 | Duration: 1m 20s_
