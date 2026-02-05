# Phase 3: Identity - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Persistent personality system that survives sessions and evolves through bootstrap flow. First interaction triggers identity creation (SOUL.md, IDENTITY.md, USER.md). Bot feels like "someone" with consistent traits, remembers user preferences, and respects personality boundaries.

</domain>

<decisions>
## Implementation Decisions

### Bootstrap Flow

- Triggers on first message from paired user if no identity files exist
- Conversational interview feel — not a form, feels like getting to know someone
- Asks about both bot identity AND user basics (name, timezone, preferences)
- Quick: 3-5 exchanges total, learn the rest naturally over time

### Personality System

- SOUL.md contains beliefs and boundaries (what the bot stands for, what it won't do)
- IDENTITY.md contains communication style and quirks (how it expresses itself)
- Boundaries enforced via soft deflection — "That's not really my thing" with personality
- Sensible default personality if bootstrap skipped — friendly assistant, customizable later

### Identity Updates

- Natural language only — no commands needed ("Can you be more casual?")
- Everything in IDENTITY.md is user-changeable (name, style, preferences, quirks)
- Changes apply instantly in the very next response
- SOUL.md is locked after bootstrap — boundaries cannot be modified

### User Memory

- USER.md captures preferences + context (communication style, interests, timezone, key facts)
- Auto-detect and write — bot notices "I prefer X" and saves without asking
- Use memory naturally when relevant, nudged to leverage it more
- Users can view and edit USER.md on request ("What do you know about me?")

### Claude's Discretion

- Exact bootstrap question wording and flow
- Default personality specifics
- How to structure SOUL.md/IDENTITY.md/USER.md internally
- When and how to surface that memory was used

</decisions>

<specifics>
## Specific Ideas

- Bootstrap should feel like making a new friend, not filling out a form
- Soft boundary enforcement: "That's not really my thing" rather than "I cannot do that"
- Bot should proactively use user context — "Since you're in SF..." not wait to be asked

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 03-identity_
_Context gathered: 2026-01-29_
