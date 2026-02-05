# Klausbot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Experimental Software**: This project runs Claude Code with `--dangerously-skip-permissions`, which bypasses safety prompts and allows unrestricted file/command access. Run in a sandboxed environment (VM, container, or dedicated user account). Use at your own risk.

## Why I Built It

Klausbot is an [OpenClaw](https://github.com/openclaw/openclaw) clone built as a thin wrapper around [Claude Code](https://docs.anthropic.com/en/docs/claude-code). This lets you use your existing Claude Code subscription rather than paying for API credits separately.

## Philosophy

Klausbot is designed to be **forked and self-hosted**. You clone the repo, configure your tokens, and run it on your own VM or in Docker. There's no npm package to install globally, no setup wizards, no service management commands — just a simple daemon that starts up and works.

The daemon auto-creates `~/.klausbot/` on first run. If something's misconfigured, it fails with a clear error message.

## What It Does

Klausbot connects Telegram to Claude through Claude Code. Send a message, get a response. It runs on your own machine and maintains conversation history across sessions.

- **24/7 Claude-powered Telegram assistant** - Send messages anytime, get thoughtful responses from Claude
- **Persistent memory** - Conversations are stored and searchable; Klausbot can recall what you discussed weeks ago
- **Scheduled tasks** - Create reminders and recurring tasks using natural language ("remind me every Monday at 9am to review expenses")
- **Voice transcription** - Send voice messages; Klausbot transcribes and processes them automatically
- **Semantic search** - Find past conversations by meaning, not just keywords (requires OpenAI API key)

## Installation

### Prerequisites

- **Node.js 20+**
- **Telegram bot token** — Create via [@BotFather](https://t.me/BotFather)
- **Claude Code** — Install and authenticate:
  ```bash
  npm install -g @anthropic-ai/claude-code
  claude login
  ```

### Quick Start

```bash
git clone https://github.com/thesobercoder/klausbot.git
cd klausbot
npm install
cp .env.example .env
# Edit .env with your TELEGRAM_BOT_TOKEN
npm run build
npm run dev -- daemon
```

### Docker

```bash
docker build -t klausbot .
docker run -d \
  -e TELEGRAM_BOT_TOKEN=your-token \
  -e ANTHROPIC_API_KEY=your-key \
  -v klausbot-data:/home/klausbot/.klausbot \
  klausbot
```

Note: You'll need to run `claude login` inside the container on first run, or mount your Claude credentials.

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

Start the gateway:
```bash
npm run dev -- daemon
```

List pending/approved users:
```bash
npm run dev -- pairing list
```

Approve pairing request:
```bash
npm run dev -- pairing approve <code>
```

Reject pairing request:
```bash
npm run dev -- pairing reject <code>
```

Revoke user access:
```bash
npm run dev -- pairing revoke <chatId>
```

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

```bash
mkdir -p ~/.klausbot/config
cp klausbot.json.example ~/.klausbot/config/klausbot.json
```

| Key | Default | Description |
|-----|---------|-------------|
| `model` | (inherited) | AI model: `opus`, `sonnet`, or `haiku` |

If `model` is not set, Klausbot uses your Claude Code default.

## Troubleshooting

### Bot not responding?

1. Check the terminal running `npm run dev -- daemon` for errors
2. Verify bot token format: `123456789:ABC-DEF...`

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
claude login
```

### Need more help?

Open an issue on [GitHub Issues](https://github.com/thesobercoder/klausbot/issues).

## License

MIT - see [LICENSE](LICENSE)

