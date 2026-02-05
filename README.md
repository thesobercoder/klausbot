# Klausbot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Experimental Software**: This project runs Claude Code with `--dangerously-skip-permissions`, which bypasses safety prompts and allows unrestricted file/command access. The container provides isolation. Use at your own risk.

## Why I Built It

Klausbot is an [OpenClaw](https://github.com/openclaw/openclaw) clone built as a thin wrapper around [Claude Code](https://docs.anthropic.com/en/docs/claude-code). This lets you use your existing Claude Code subscription rather than paying for API credits separately.

## Philosophy

Klausbot is designed to **run inside a container**. Whether locally or on a remote server, the container is the deployment unit. This provides isolation for Claude Code's unrestricted file access and makes deployment consistent everywhere.

## What It Does

Klausbot connects Telegram to Claude through Claude Code. Send a message, get a response. It maintains conversation history across sessions.

- **24/7 Claude-powered Telegram assistant** - Send messages anytime, get thoughtful responses
- **Persistent memory** - Conversations stored and searchable; recalls discussions from weeks ago
- **Scheduled tasks** - Natural language reminders ("remind me every Monday at 9am to review expenses")
- **Voice transcription** - Send voice messages; transcribed and processed automatically
- **Semantic search** - Find past conversations by meaning (requires OpenAI API key)

## Installation

### Prerequisites

- **Docker** and **Docker Compose**
- **Telegram bot token** — Create via [@BotFather](https://t.me/BotFather)
- **Claude Code token** — Generate on any machine with Claude Code installed:
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
2. Send `/start` — the bot displays a 6-character pairing code
3. Approve the pairing:
   ```bash
   docker compose exec bot klausbot pairing approve XXXXXX
   ```
4. You're connected! Send any message to chat with Claude.

Only approved users can interact with the bot.

## Usage

### CLI Commands

All commands work in both Docker and local environments:

| Action | Docker | Local |
| ------ | ------ | ----- |
| **Start daemon** | `docker compose up -d` | `npm run dev -- daemon` |
| **View logs** | `docker compose logs -f` | (logs to stdout) |
| **Restart** | `docker compose restart` | (restart process) |

#### Pairing

| Action | Docker | Local |
| ------ | ------ | ----- |
| List users | `docker compose exec bot klausbot pairing list` | `npm run dev -- pairing list` |
| Approve | `docker compose exec bot klausbot pairing approve <code>` | `npm run dev -- pairing approve <code>` |
| Reject | `docker compose exec bot klausbot pairing reject <code>` | `npm run dev -- pairing reject <code>` |
| Revoke | `docker compose exec bot klausbot pairing revoke <chatId>` | `npm run dev -- pairing revoke <chatId>` |

#### Cron Jobs

| Action | Docker | Local |
| ------ | ------ | ----- |
| List jobs | `docker compose exec bot klausbot cron list` | `npm run dev -- cron list` |
| Enable | `docker compose exec bot klausbot cron enable <id>` | `npm run dev -- cron enable <id>` |
| Disable | `docker compose exec bot klausbot cron disable <id>` | `npm run dev -- cron disable <id>` |
| Delete | `docker compose exec bot klausbot cron delete --id <id>` | `npm run dev -- cron delete --id <id>` |

### Telegram Commands

| Command   | Description                     |
| --------- | ------------------------------- |
| `/start`  | Request pairing or check status |
| `/status` | Show queue and approval status  |
| `/model`  | Show current model info         |
| `/crons`  | List scheduled tasks            |
| `/help`   | Show available commands         |

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

Optional configuration mounted at `/home/klausbot/.klausbot/config/klausbot.json`:

| Key     | Default     | Description                            |
| ------- | ----------- | -------------------------------------- |
| `model` | (inherited) | AI model: `opus`, `sonnet`, or `haiku` |

If `model` is not set, Klausbot uses your Claude Code default.

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

### Pairing code not working?

1. Codes are case-insensitive but must match exactly
2. Codes expire after 15 minutes — send `/start` again for a new one
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
