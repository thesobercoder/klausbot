FROM node:22-slim

# Install system dependencies (Claude Code CLI + agent tools)
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      curl \
      git \
      ca-certificates \
      gnupg \
      python3 \
      python3-pip \
      poppler-utils \
      ffmpeg \
      libavcodec-extra \
      libavformat-dev \
      ripgrep \
      jq \
      imagemagick \
      pandoc \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack (built into Node 22)
RUN corepack enable pnpm

# Create non-root user first (Claude Code installs to ~/.local/bin)
RUN useradd -m -s /bin/bash klausbot

# Switch to non-root user for Claude Code installation
USER klausbot
WORKDIR /home/klausbot

# Install Claude Code CLI (native installer)
RUN curl -fsSL https://claude.ai/install.sh | bash

# Install uv (fast Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Add tools to PATH (~/.local/bin for Claude Code and uv)
ENV PATH="/home/klausbot/.local/bin:${PATH}"

# Install skills
RUN npx -y skills@latest add https://github.com/anthropics/skills --skill skill-creator -y -a claude-code -g
RUN npx -y skills@latest add https://github.com/vercel-labs/skills --skill find-skills -y -a claude-code -g

# Switch back to root for app setup
USER root
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy built application
COPY dist ./dist

# Create klausbot alias
RUN printf '#!/bin/sh\nnode /app/dist/index.js "$@"\n' > /usr/local/bin/klausbot \
    && chmod +x /usr/local/bin/klausbot

# Set ownership
RUN chown -R klausbot:klausbot /app

# Ensure klausbot home directory is fully owned by klausbot
RUN mkdir -p /home/klausbot/.klausbot && chown -R klausbot:klausbot /home/klausbot

# Environment
ENV NODE_ENV=production
ENV KLAUSBOT_HOME=/home/klausbot/.klausbot
ENV KLAUSBOT_CONTAINER=1

# Switch to non-root user
USER klausbot

CMD ["node", "dist/index.js", "daemon"]
