# Klausbot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Experimental Software**: This project runs Claude Code with `--dangerously-skip-permissions`, which bypasses safety prompts and allows unrestricted file/command access. The container provides isolation. Use at your own risk.

## Why I Built It

Klausbot is an [OpenClaw](https://github.com/openclaw/openclaw) clone built as a thin wrapper around [Claude Code](https://docs.anthropic.com/en/docs/claude-code). This lets you use your existing Claude Code subscription rather than paying for API credits separately.

## Philosophy

Klausbot is designed to **run inside a container**. Whether locally or on a remote server, the container is the deployment unit. This provides isolation for Claude Code's unrestricted file access and makes deployment consistent everywhere.

## What It Does

Klausbot connects Telegram to Claude through Claude Code. Send a message, get a response. It maintains conversation history across sessions and self-improves over time.

- **24/7 Claude-powered Telegram assistant** - Send messages anytime, get thoughtful responses
- **Persistent memory** - Conversations stored and searchable; recalls discussions from weeks ago
- **Self-evolving identity** - Learns your preferences, adjusts personality, remembers context
- **Scheduled tasks** - Natural language reminders ("remind me every Monday at 9am to review expenses")
- **Heartbeat awareness** - Periodic check-ins; can be reminded to watch for things
- **Real-time streaming** - See responses as they're generated (draft message updates)
- **Background agents** - Delegates long-running work to background processes, notifies on completion
- **Voice transcription** - Send voice messages; transcribed and processed automatically
- **Semantic search** - Find past conversations by meaning (requires OpenAI API key)
- **Custom agents** - Create specialized agents via chat for recurring tasks
- **Skills** - Extensible command system (auto-discovered from `~/.claude/skills/`)

## Installation

### Prerequisites

- **Docker** and **Docker Compose**
- **Telegram bot token** - Create via [@BotFather](https://t.me/BotFather)
- **Claude Code token** - Generate on any machine with Claude Code installed:
  ```bash
  claude setup-token
  ```

### Quick Start

```bash
git clone https://github.com/thesobercoder/klausbot.git
cd klausbot
cp .env.example .env
# Edit .env with TELEGRAM_BOT_TOKEN and CLAUDE_CODE_OAUTH_TOKEN
docker compose up -d
```

### Pairing Your Telegram Account

1. Find your bot on Telegram (the username you created with @BotFather)
2. Send `/start` - the bot displays a 6-character pairing code
3. Approve the pairing:
   ```bash
   docker compose exec bot klausbot pairing approve XXXXXX
   ```
4. You're connected! Send any message to chat with Claude.

Only approved users can interact with the bot.

## Features

### Identity System

Klausbot maintains a set of identity files that define its personality and memory. These live in `~/.klausbot/identity/` and are loaded into every session.

| File           | Mutability | Purpose                                              |
| -------------- | ---------- | ---------------------------------------------------- |
| `SOUL.md`      | Locked     | Core values and boundaries. Never modified.          |
| `IDENTITY.md`  | Mutable    | Name, personality, communication style.              |
| `USER.md`      | Mutable    | Learned preferences, context about you.              |
| `REMINDERS.md` | Mutable    | Important notes tagged with `[!important]`.          |
| `LEARNINGS.md` | Mutable    | Past mistakes and lessons to avoid repeating errors. |

These files are created during the bootstrap process (first conversation). The bot updates `USER.md` and `REMINDERS.md` automatically as it learns. You can ask it to change its personality (updates `IDENTITY.md`) or remember something important (updates `REMINDERS.md`).

### Heartbeat System

Klausbot periodically reads `~/.klausbot/HEARTBEAT.md` and acts on its contents. Think of it as a checklist the bot reviews on a schedule.

- **Default interval**: 30 minutes
- **Format**: Markdown checkboxes with optional expiry dates
- **Suppression**: If nothing needs attention, the bot responds with `HEARTBEAT_OK` (no Telegram message sent)
- **Note collection**: Tell the bot "remind me to check on X" or "don't forget about Y" and it adds structured notes to the heartbeat file

Example `HEARTBEAT.md`:

```markdown
- [ ] Check if backup completed [expires: 2026-02-10]
- [ ] Review PR #42 when tests pass
```

### Streaming

When enabled, responses appear in real-time as draft message updates in Telegram, so you see Claude thinking as it types.

- Requires **Threaded Mode** enabled in BotFather settings
- Falls back to batch mode automatically if streaming isn't available
- Throttled to avoid Telegram API rate limits (configurable)

### Threading

Conversations in threaded Telegram chats stay organized. Replies are linked to the original message, and subsequent chunks stay in-thread.

### Background Agents

The main bot operates as a **fast dispatcher** with a ~60 second time budget. For anything that takes longer - research, building, analysis, multi-step work - it automatically spawns a background agent.

How it works:

1. You ask for something substantial ("research X", "build me Y")
2. The bot acknowledges immediately and spawns a background Claude process
3. The daemon watches for task completion
4. You get a Telegram notification with a summary when it's done

You can chat about other things while background tasks run.

### Custom Agents

Ask the bot to create specialized agents for recurring tasks. Agents are saved as markdown files in `~/.claude/agents/` and used automatically when relevant.

Example: "Create an agent that reviews Python code for security issues" - the bot writes the agent definition and uses it when you ask for code reviews.

### Skills

Skills are extensible commands auto-discovered from `~/.claude/skills/`. Each skill is a directory containing a `SKILL.md` file with YAML frontmatter. Installed skills appear in the Telegram command menu.

## Usage

### CLI Commands

All commands work in both Docker and local environments.

#### Daemon

```bash
# Docker
docker compose up -d
docker compose logs -f
docker compose restart

# Local
npm run dev -- daemon
```

#### Pairing

```bash
# Docker
docker compose exec bot klausbot pairing list
docker compose exec bot klausbot pairing approve <code>
docker compose exec bot klausbot pairing reject <code>
docker compose exec bot klausbot pairing revoke <chatId>

# Local
npm run dev -- pairing list
npm run dev -- pairing approve <code>
npm run dev -- pairing reject <code>
npm run dev -- pairing revoke <chatId>
```

#### Cron Jobs

```bash
# Docker
docker compose exec bot klausbot cron list
docker compose exec bot klausbot cron enable <id>
docker compose exec bot klausbot cron disable <id>
docker compose exec bot klausbot cron delete --id <id>

# Local
npm run dev -- cron list
npm run dev -- cron enable <id>
npm run dev -- cron disable <id>
npm run dev -- cron delete --id <id>
```

### Telegram Commands

| Command   | Description                     |
| --------- | ------------------------------- |
| `/start`  | Request pairing or check status |
| `/status` | Show queue and approval status  |
| `/model`  | Show current model info         |
| `/crons`  | List scheduled tasks            |
| `/help`   | Show available commands         |

Skills register additional commands automatically (e.g. `/skill_name`).

## Configuration

### Environment Variables

Configure in `.env` file:

| Variable                  | Required  | Default | Description                                          |
| ------------------------- | --------- | ------- | ---------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`      | Yes       | -       | Telegram bot token from @BotFather                   |
| `CLAUDE_CODE_OAUTH_TOKEN` | Container | -       | Claude Code token from `claude setup-token`          |
| `OPENAI_API_KEY`          | No        | -       | OpenAI API key for semantic memory search            |
| `LOG_LEVEL`               | No        | `info`  | Log level (silent/trace/debug/info/warn/error/fatal) |

### JSON Configuration

Optional configuration at `~/.klausbot/config/klausbot.json`:

| Key                          | Default      | Description                                   |
| ---------------------------- | ------------ | --------------------------------------------- |
| `model`                      | (inherited)  | AI model: `opus`, `sonnet`, or `haiku`        |
| `streaming.enabled`          | `true`       | Enable real-time draft streaming              |
| `streaming.throttleMs`       | `500`        | Draft update interval (100-2000ms)            |
| `heartbeat.enabled`          | `true`       | Enable periodic heartbeat checks              |
| `heartbeat.intervalMs`       | `1800000`    | Heartbeat interval in ms (min: 60000 = 1 min) |
| `subagents.enabled`          | `true`       | Allow spawning background agents              |
| `subagents.taskListIdPrefix` | `"klausbot"` | Prefix for task list IDs                      |

Unknown keys cause validation failure (strict mode). Config supports hot-reload - changes take effect without restart.

If `model` is not set, Klausbot uses your Claude Code default.

## Architecture

```
Telegram  -->  Gateway (grammY)  -->  Claude Code CLI
                  |                        |
                  |                   Hooks (SessionStart/End)
                  |                        |
              Message Queue           MCP Server (cron, memory)
                  |
            +-----+-----+
            |           |
        Heartbeat   Task Watcher
        Scheduler   (background agents)
```

- **Gateway**: Polls Telegram, queues messages, spawns Claude Code per message
- **Spawner**: Runs Claude CLI with identity, hooks, MCP config, and orchestration instructions
- **Hooks**: `SessionStart` injects recent context, `SessionEnd` stores transcript with summary
- **MCP Server**: Provides `create_cron`, `list_crons`, `update_cron`, `delete_cron`, `search_memories`, `get_conversation` tools
- **Heartbeat**: Periodic scheduler that spawns Claude to review `HEARTBEAT.md`
- **Task Watcher**: Polls `~/.klausbot/tasks/completed/` and sends Telegram notifications for finished background tasks

### Platform Support

| Platform         | Status        | Notes                     |
| ---------------- | ------------- | ------------------------- |
| macOS            | Supported     | Intel and Apple Silicon   |
| Linux            | Supported     | Native                    |
| WSL2             | Supported     | Detected via kernel check |
| Docker           | Supported     | Primary deployment target |
| Windows (native) | Not supported | Use WSL2                  |

Capabilities (Claude CLI, Telegram, OpenAI embeddings) are detected at startup with clear status messages.

## Troubleshooting

### Bot not responding?

Check container logs:

```bash
docker compose logs -f
```

Verify bot token format: `123456789:ABC-DEF...`

### Memory search not working?

Semantic search requires an OpenAI API key. Add to `.env`:

```bash
OPENAI_API_KEY=sk-your-key-here
```

Then restart: `docker compose restart`

### Streaming not working?

Streaming requires **Threaded Mode** enabled in BotFather:

1. Open @BotFather
2. Select your bot
3. Bot Settings > Group Privacy > Enable "Threaded Mode"

If streaming fails, the bot falls back to batch mode automatically.

### Pairing code not working?

1. Codes are case-insensitive but must match exactly
2. Codes expire after 15 minutes - send `/start` again for a new one
3. Check pending requests:
   ```bash
   docker compose exec bot klausbot pairing list
   ```

### Need more help?

Open an issue on [GitHub Issues](https://github.com/thesobercoder/klausbot/issues).

## Development

For local development without Docker:

```bash
npm install
cp .env.example .env
# Edit .env with TELEGRAM_BOT_TOKEN
# Ensure Claude Code is installed and authenticated: claude login
npm run build
npm run dev -- daemon
```

## License

MIT - see [LICENSE](LICENSE)
