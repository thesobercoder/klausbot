# Phase 17: Docker & Release - Research

**Researched:** 2026-02-04
**Domain:** README documentation, configuration reference, troubleshooting guides
**Confidence:** HIGH

## Summary

This phase focuses on comprehensive documentation (RLSE-01 through RLSE-05) with Docker marked "Coming Soon" per user decision. The project already has all features implemented; this phase documents them for users.

Research confirms standard README patterns: story-first structure matches user decision, MIT badge via shields.io, environment variable tables with Required/Default columns, and FAQ-style troubleshooting. The codebase already contains all information needed - configuration schemas, CLI commands, Telegram commands, and MCP tools.

**Primary recommendation:** Single comprehensive README.md with all documentation inline (no separate docs/ folder), structured as: Story > Features > Installation > Usage > Configuration > Troubleshooting > License.

## Standard Stack

This phase is documentation-only. No new libraries required.

### Documentation Tools
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| shields.io | MIT license badge | Industry standard, widely recognized |
| Markdown tables | Configuration reference | Native GitHub rendering, no dependencies |
| Code blocks | Command examples | Clear, copyable examples |

### Badge Format
```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
```

## Architecture Patterns

### README Structure (Decision-Aligned)

Per user decision: Story first, single file, minimal badges.

```markdown
# klausbot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Screenshot placeholder - klausbot Telegram interaction]

## Why I Built It

[Personal narrative - user's background and journey]
[Vision - what klausbot represents]

## What It Does

[2-3 paragraph feature overview]
- 24/7 Claude-powered Telegram assistant
- Persistent memory across conversations
- Scheduled tasks via natural language
- Voice message transcription

## Installation

### Prerequisites
- Node.js 20+
- Telegram bot token (from @BotFather)
- Claude CLI installed and authenticated

### Quick Start
```bash
npm install -g klausbot
klausbot setup
```

### Docker (Coming Soon)
Docker support planned for future release.

## Usage

### CLI Commands
[Table of all CLI commands]

### Telegram Commands
[Table of all Telegram commands]

## Configuration

### Environment Variables
[Table: Variable | Required | Default | Description]

### JSON Configuration
[Table for ~/.klausbot/config/klausbot.json options]

## Troubleshooting

### Common Questions
[FAQ format Q&A]

### Diagnostic Commands
[Commands to check status]

## License
MIT - see LICENSE
```

### Environment Variable Table Format
Per user decision: Required column with Yes/No.

```markdown
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| TELEGRAM_BOT_TOKEN | Yes | - | Bot token from @BotFather |
| OPENAI_API_KEY | No | - | Enables semantic memory search |
| LOG_LEVEL | No | info | Logging verbosity (trace/debug/info/warn/error) |
```

### FAQ Troubleshooting Format
Per user decision: Q&A format with diagnostic commands.

```markdown
## Troubleshooting

### Bot not responding?

1. Check service status:
   ```bash
   klausbot status
   ```

2. Verify bot token:
   - Token format: `123456789:ABC-DEF...`
   - Test with @BotFather's /token command

3. Check logs:
   - macOS: `~/Library/LaunchAgents/` logs
   - Linux: `journalctl --user -u klausbot`

### Memory search not working?

OpenAI API key required for semantic search.
- Check: `klausbot status` shows "OpenAI API Key: configured"
- Fix: Add OPENAI_API_KEY to ~/.klausbot/.env

### How do I restart after config changes?

```bash
klausbot restart
```
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Badge generation | Custom SVGs | shields.io | Consistent, cached, trusted |
| Doc site | Separate docs/ folder | README.md | User decision: single file |
| License badge | Custom format | Standard MIT badge | Recognition |

## Common Pitfalls

### Pitfall 1: Incomplete .env.example
**What goes wrong:** Users copy .env.example but miss optional vars they need
**Why it happens:** Example file only shows required vars
**How to avoid:** Include ALL vars in .env.example with comments explaining each
**Warning signs:** Users ask "how do I enable X" when it's just missing env var

### Pitfall 2: Platform-Specific Troubleshooting
**What goes wrong:** Troubleshooting section becomes bloated with OS-specific paths
**Why it happens:** Different log locations, service commands per platform
**How to avoid:** Use `klausbot status` as universal diagnostic (per user decision)
**Warning signs:** README growing with "on macOS do X, on Linux do Y"

### Pitfall 3: Stale Screenshots
**What goes wrong:** Screenshots show outdated UI/commands
**Why it happens:** Screenshots captured once, never updated
**How to avoid:** Use representative, stable interactions; avoid showing version numbers
**Warning signs:** Users report "my screen looks different"

### Pitfall 4: Missing Prerequisites
**What goes wrong:** Users hit cryptic errors during installation
**Why it happens:** Prerequisites assumed but not documented
**How to avoid:** List ALL prerequisites with version requirements and verification commands
**Warning signs:** Issues like "command not found: claude"

## Code Examples

### CLI Command Reference (from codebase)

Based on `src/index.ts`:

| Command | Description |
|---------|-------------|
| `klausbot setup` | First-time setup wizard |
| `klausbot daemon` | Start the gateway daemon |
| `klausbot status` | Check service and config status |
| `klausbot restart` | Restart background service |
| `klausbot uninstall` | Remove background service |
| `klausbot init` | Reset ~/.klausbot/ directory |
| `klausbot cron [action] [id]` | Manage scheduled jobs (list/enable/disable/delete) |
| `klausbot config validate` | Validate environment and config |
| `klausbot pairing list` | List pending/approved users |
| `klausbot pairing approve <code>` | Approve pairing request |
| `klausbot pairing reject <code>` | Reject pairing request |
| `klausbot pairing revoke <chatId>` | Revoke user access |
| `klausbot hook start/compact/end` | Claude Code session hooks (internal) |
| `klausbot mcp` | MCP server for Claude CLI (internal) |

### Telegram Command Reference (from codebase)

Based on `src/telegram/commands.ts`:

| Command | Description |
|---------|-------------|
| `/start` | Request pairing or check status |
| `/status` | Show queue and approval status |
| `/model` | Show current model info |
| `/crons` | List scheduled tasks |
| `/help` | Show available commands |

### Environment Variables (from codebase)

Based on `src/config/schema.ts`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | - | Telegram bot token from @BotFather |
| `OPENAI_API_KEY` | No | - | OpenAI API key for semantic memory search |
| `LOG_LEVEL` | No | `info` | Log level: silent/trace/debug/info/warn/error/fatal |

### JSON Configuration (from codebase)

Based on `src/config/schema.ts`, file at `~/.klausbot/config/klausbot.json`:

| Key | Default | Description |
|-----|---------|-------------|
| `model` | `claude-sonnet-4-20250514` | AI model for responses |
| `logVerbosity` | `normal` | Logging detail: minimal/normal/verbose |
| `preferences.timezone` | - | Timezone for date/time formatting |
| `preferences.language` | `en` | Preferred language code |

### .env.example Template

```bash
# Telegram Bot Token (required)
# Get from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=

# Log level (optional, default: info)
# Options: silent, trace, debug, info, warn, error, fatal
LOG_LEVEL=info

# OpenAI API Key (optional)
# Required for semantic memory search
# Get from https://platform.openai.com/account/api-keys
OPENAI_API_KEY=
```

### MCP Tools (from codebase)

For power users - tools available when klausbot runs as MCP server:

| Tool | Description |
|------|-------------|
| `search_memories` | Search past conversations semantically |
| `get_conversation` | Retrieve full transcript by session ID |
| `create_cron` | Create scheduled task |
| `list_crons` | List scheduled tasks for chat |
| `delete_cron` | Delete scheduled task |
| `update_cron` | Modify existing scheduled task |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multi-file docs | Single README | User decision | Everything discoverable in one place |
| Docker first | Docker "Coming Soon" | User decision | Focus on docs quality first |
| Generic badges | Minimal (MIT only) | User decision | Clean, uncluttered appearance |

## Open Questions

1. **Screenshot selection**
   - What we know: User wants static screenshots of Telegram interaction
   - What's unclear: Which interactions best showcase klausbot
   - Recommendation: Show pairing flow + conversation + cron creation

2. **"Why I Built It" content**
   - What we know: User wants personal narrative, longer background
   - What's unclear: Specific story details (user must provide)
   - Recommendation: Planner should include placeholder with prompts for user to fill

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/index.ts`, `src/config/schema.ts`, `src/telegram/commands.ts`, `src/mcp-server/tools/*.ts`
- User context: `17-CONTEXT.md` (all decisions)

### Secondary (MEDIUM confidence)
- [Make a README](https://www.makeareadme.com/) - Standard README structure
- [shields.io](https://shields.io/) - Badge generation service
- [Markdown License Badges](https://gist.github.com/lukas-h/2a5d00690736b4c3a7ba) - MIT badge format

### Tertiary (LOW confidence)
- General README best practices from web search (not project-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No libraries needed, pure documentation
- Architecture: HIGH - User decisions are explicit, codebase provides all content
- Pitfalls: MEDIUM - Based on general documentation experience

**Research date:** 2026-02-04
**Valid until:** 60 days (documentation patterns stable)
