# klausbot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Screenshot placeholder - klausbot Telegram interaction]

## Why I Built It

<!--
USER: Fill in your personal narrative here.
- What problem were you trying to solve?
- What's your background/journey?
- What vision does klausbot represent?
-->

[Personal narrative to be added]

## What It Does

klausbot is a Telegram gateway that connects you to Claude, Anthropic's AI assistant, through a persistent conversational interface. It runs 24/7 on your own infrastructure, giving you a private AI assistant that never forgets your context and learns from every interaction.

Unlike web-based chat interfaces that reset with each session, klausbot maintains continuous memory of your conversations. It stores transcripts, learns your preferences, and can recall relevant context from past discussions. This creates a truly personal assistant that grows more helpful over time.

The bot integrates with Claude's MCP (Model Context Protocol) tools, enabling capabilities beyond simple chat:

- **24/7 Claude-powered Telegram assistant** - Send messages anytime, get thoughtful responses from Claude
- **Persistent memory** - Conversations are stored and searchable; Claude can recall what you discussed weeks ago
- **Scheduled tasks** - Create reminders and recurring tasks using natural language ("remind me every Monday at 9am to review expenses")
- **Voice transcription** - Send voice messages; klausbot transcribes and processes them automatically
- **Semantic search** - Find past conversations by meaning, not just keywords (requires OpenAI API key)

## Installation

### Prerequisites

- **Node.js 20+** - JavaScript runtime
- **Telegram bot token** - Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
- **Claude CLI** - Install and authenticate: `npm install -g @anthropic-ai/claude-code`

### Quick Start

```bash
npm install -g klausbot
klausbot setup
```

The setup wizard guides you through:
1. Configuring your Telegram bot token
2. Initializing the data directory (~/.klausbot/)
3. Installing the background service (launchd on macOS, systemd on Linux)

### Docker (Coming Soon)

Docker support is planned for a future release. For now, use the native installation above.

