FROM node:20-slim

# Install dependencies for Claude Code CLI
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user first (Claude Code installs to ~/.local/bin)
RUN useradd -m -s /bin/bash klausbot

# Switch to non-root user for Claude Code installation
USER klausbot
WORKDIR /home/klausbot

# Install Claude Code CLI (native installer)
RUN curl -fsSL https://claude.ai/install.sh | bash

# Add Claude Code to PATH
ENV PATH="/home/klausbot/.local/bin:${PATH}"

# Switch back to root for app setup
USER root
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy built application
COPY dist ./dist

# Create data directory and set ownership
RUN mkdir -p /app/data && chown -R klausbot:klausbot /app

# Environment
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

# Switch to non-root user
USER klausbot

CMD ["node", "dist/index.js", "daemon"]
