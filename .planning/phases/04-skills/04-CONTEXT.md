# Phase 4: Skills - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Extensible capabilities system where Claude selects and executes reusable skills from a folder, and can create new skills via the skill-creator. Users invoke skills via Telegram commands. This phase does NOT include scheduled execution (Phase 5), skill marketplace, or cloud skill sharing.

</domain>

<decisions>
## Implementation Decisions

### Skill format & structure

- Use standard Claude Code skills format (`.claude/skills/<name>/SKILL.md`)
- Skills installed to `~/.claude/skills/` (global location)
- Local curated registry in klausbot repo (JSON/YAML listing available skills)
- Interactive CLI picker for installation: `klausbot skills` shows list, user selects

### Invocation pattern

- Same as moltbot: both `/skill <name> [args]` and `/<skillname> [args]` work
- Claude can auto-select skills from natural language based on system prompt
- Skills registered as Telegram bot commands (appear in `/` menu)
- No disambiguation needed — skill names are unique folder names

### Skill creation flow

- Primary method: Anthropic's skill-creator skill
- Claude proactively suggests skill creation after recognizing repeated patterns
- Approval happens via natural language conversation (no rigid confirm/edit flow)

### Pre-installed skills

- skill-creator ships mandatory (installed automatically)
- Curated defaults from three categories: Productivity, Information, Utilities
- **Constraint:** Zero-dependency skills only — must work out of the box without external tools or API keys
- Skip calendar/reminder skills that require external integrations

### Claude's Discretion

- Exact curated defaults selection (research moltbot skills, pick zero-dep ones)
- Registry file format (JSON vs YAML)
- How to detect "repeated patterns" for proactive skill suggestions

</decisions>

<specifics>
## Specific Ideas

- Follow moltbot's skill architecture closely — it's proven and well-documented
- Skill-creator is Anthropic's official skill, not custom
- Reference: [moltbot/skills/skill-creator/SKILL.md](https://github.com/moltbot/moltbot/tree/main/skills/skill-creator)

</specifics>

<deferred>
## Deferred Ideas

- Scheduled skill execution — Phase 5 (Proactive/Cron)
- Skills requiring external tools (calendar, email) — requires tool installation system
- Skill sharing/marketplace — out of scope for MVP

</deferred>

---

_Phase: 04-skills_
_Context gathered: 2026-01-29_
