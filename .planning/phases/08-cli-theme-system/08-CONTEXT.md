# Phase 8: CLI Theme System - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Unified CLI output formatting with consistent colors, helper methods, and visual identity. All user-facing CLI output uses theme helpers; all system logging uses pino logger (never console.log for logging).

</domain>

<decisions>
## Implementation Decisions

### Color Scheme

- Muted aesthetic — softer, pastel-like tones (not vibrant/bold)
- Success: muted green (standard recognition)
- Headers/titles: bold + color (prominent but not harsh)
- Respect NO_COLOR environment variable for accessibility and piping
- Auto-detect terminal capabilities (256 color, truecolor) with graceful fallback

### Helper Methods

- Custom wrapper around chalk (no external table/spinner libraries)
- Full suite of helpers: success(), error(), warn(), info(), header(), list(), table(), keyValue(), spinner(), progress(), box(), divider()
- ASCII art header method for "klausbot" branding
- Tables use Unicode box drawing characters (─, │, ┌)
- Helpers output directly (console.log internally) — not return strings

### Output Discipline

- User-facing output: theme helpers ONLY
- System logs: pino logger ONLY
- No raw console.log calls anywhere in application

### Configuration

- No user customization — single hardcoded theme
- Singleton pattern: `import { theme } from './theme'`
- Module location: Claude's discretion based on project structure

### ASCII Art

- "klausbot" in stylized ASCII art
- Displays on: `klausbot --help` and `klausbot init` (setup wizard)
- Not on every command

### Migration

- All at once — single phase replaces all chalk calls
- Hide chalk entirely — all color needs through theme helpers only
- Adopt new theme — output may look different but will be consistent
- All user-facing console.log calls use theme (no exceptions)

### Claude's Discretion

- Exact muted color hex values / ANSI codes
- Theme module file location
- Helper method signatures and API design
- ASCII art font/style choice

</decisions>

<specifics>
## Specific Ideas

- Muted aesthetic like Stripe CLI or Vercel CLI — professional, not flashy
- Box drawing for tables gives modern feel without external deps
- Clear separation: theme for users, pino for operators

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 08-cli-theme-system_
_Context gathered: 2026-01-31_
