# klausbot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Experimental Software**: This project runs Claude Code with `--dangerously-skip-permissions`, which bypasses safety prompts and allows unrestricted file/command access. Run in a sandboxed environment (VM, container, or dedicated user account). Use at your own risk.

## Why I Built It

I wanted to use [OpenClaw](https://github.com/openclaw/openclaw) — a Telegram bot that lets you chat with Claude — but couldn't due to Anthropic Terms of Service restrictions. So I built klausbot as an alternative approach.

klausbot is a thin wrapper around [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that connects it to Telegram. This lets you use your existing Claude Code subscription rather than paying for API credits separately.

## What It Does

klausbot connects Telegram to Claude through Claude Code. Send a message, get a response. It runs on your own machine and maintains conversation history across sessions.

- **24/7 Claude-powered Telegram assistant** - Send messages anytime, get thoughtful responses from Claude
- **Persistent memory** - Conversations are stored and searchable; Claude can recall what you discussed weeks ago
- **Scheduled tasks** - Create reminders and recurring tasks using natural language ("remind me every Monday at 9am to review expenses")
- **Voice transcription** - Send voice messages; klausbot transcribes and processes them automatically
- **Semantic search** - Find past conversations by meaning, not just keywords (requires OpenAI API key)

## Installation

### Prerequisites

- **Node.js 20+**
- **Telegram bot token** — Create via [@BotFather](https://t.me/BotFather)
- **Claude Code** — Install and authenticate: `npm install -g @anthropic-ai/claude-code && claude auth login`

### Quick Start

```bash
git clone https://github.com/yourusername/klausbot.git
cd klausbot
npm install
cp .env.example .env
# Edit .env with your TELEGRAM_BOT_TOKEN
npm run dev
```

### Global Installation (Optional)

To run `klausbot` from anywhere:

```bash
npm link
mkdir -p ~/.klausbot
cp .env.example ~/.klausbot/.env
# Edit ~/.klausbot/.env with your TELEGRAM_BOT_TOKEN
```

Then run with `klausbot` instead of `npm run dev`.

### Pairing Your Telegram Account

1. Find your bot on Telegram (the username you created with @BotFather)
2. Send `/start` — the bot displays a 6-character pairing code
3. In another terminal, approve the pairing:
   ```bash
   npm run dev -- pairing approve XXXXXX
   ```
4. You're connected! Send any message to chat with Claude.

Only approved users can interact with the bot.

## Usage

### CLI Commands

Run commands with `npm run dev --`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the bot |
| `npm run dev -- cron list` | List scheduled jobs |
| `npm run dev -- cron enable <id>` | Enable a cron job |
| `npm run dev -- cron disable <id>` | Disable a cron job |
| `npm run dev -- pairing list` | List pending/approved users |
| `npm run dev -- pairing approve <code>` | Approve pairing request |
| `npm run dev -- pairing reject <code>` | Reject pairing request |
| `npm run dev -- pairing revoke <chatId>` | Revoke user access |

### Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Request pairing or check status |
| `/status` | Show queue and approval status |
| `/model` | Show current model info |
| `/crons` | List scheduled tasks |
| `/help` | Show available commands |

## Configuration

### Environment Variables

Environment variables are loaded from `.env` in the project folder or `~/.klausbot/.env` (both work):

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | - | Telegram bot token from @BotFather |
| `OPENAI_API_KEY` | No | - | OpenAI API key for semantic memory search |
| `LOG_LEVEL` | No | `info` | Log level (silent/trace/debug/info/warn/error/fatal) |

### JSON Configuration

Optional configuration in `~/.klausbot/config/klausbot.json`:

```json
{
  "logVerbosity": "normal"
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `logVerbosity` | `normal` | Logging detail (minimal/normal/verbose) |

The AI model is inherited from your Claude Code configuration.

## Troubleshooting

### Bot not responding?

1. Check the terminal running `npm run dev` for errors
2. Verify bot token format: `123456789:ABC-DEF...`
3. Run `npm run dev -- status` to check config

### Memory search not working?

Semantic search requires an OpenAI API key. Add to `.env`:

```bash
OPENAI_API_KEY=sk-your-key-here
```

Then restart the bot.

### Pairing code not working?

1. Codes are case-insensitive but must match exactly
2. Codes expire after 15 minutes — send `/start` again for a new one
3. Check pending requests: `npm run dev -- pairing list`

### Claude Code not authenticated?

```bash
npm install -g @anthropic-ai/claude-code
claude auth login
```

### Need more help?

Open an issue on [GitHub Issues](https://github.com/yourusername/klausbot/issues).

## License

MIT - see [LICENSE](LICENSE)

