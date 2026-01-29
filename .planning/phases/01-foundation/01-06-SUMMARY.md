---
phase: 01-foundation
plan: 06
subsystem: deployment
tags: [cli, install, systemd, docker, wizard]

dependency-graph:
  requires: [01-05]
  provides: [install-wizard, systemd-service, dockerfile]
  affects: [01-07]

tech-stack:
  added: []
  patterns: [interactive-wizard, systemd-unit, docker-build]

key-files:
  created:
    - src/cli/install.ts
    - src/cli/index.ts
    - klausbot.service
    - Dockerfile
    - .dockerignore
  modified:
    - src/index.ts

decisions:
  - id: wizard-modes
    choice: Three deployment modes (systemd, docker, dev)
    reason: Cover all deployment scenarios
  - id: systemd-security
    choice: Security hardening in service file
    reason: NoNewPrivileges, PrivateTmp, ProtectSystem, ProtectHome

metrics:
  duration: 4 min
  completed: 2026-01-29
---

# Phase 01 Plan 06: Deployment Tooling Summary

**One-liner:** Interactive install wizard with systemd, Docker, and dev deployment modes

## What Was Built

### 1. Install Wizard (src/cli/install.ts)
- **runInstallWizard()**: Interactive prompts via @inquirer/prompts
- Prerequisites check: Claude CLI detection with continue-anyway option
- Token validation: Must contain `:` for Telegram format
- Deployment modes:
  - **systemd**: Generate .env + service file, optional auto-install
  - **docker**: Generate .env, print docker run command
  - **dev**: Generate .env, print npm run dev

Key flows:
- Systemd: Creates klausbot user, directories, installs service
- Docker: Verifies docker available, creates data mount point
- Dev: Simple .env generation

### 2. systemd Service (klausbot.service)
- Type=simple with auto-restart (10s delay)
- Security hardening: NoNewPrivileges, PrivateTmp, ProtectSystem, ProtectHome
- ReadWritePaths for data directory only
- EnvironmentFile for .env loading
- After=network-online.target for network deps

### 3. Docker (Dockerfile, .dockerignore)
- node:20-slim base image
- Non-root klausbot user
- Production-only npm install
- /app/data volume mount point
- .dockerignore excludes node_modules, src, .git, .env

### 4. CLI Integration (src/index.ts)
- `klausbot install` -> runInstallWizard()
- `klausbot version` -> reads package.json
- Updated help text with all commands

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| 1272f50 | feat(01-06): create interactive install wizard |
| 9f2ccd5 | feat(01-06): add systemd service and Dockerfile |
| 37d297f | feat(01-06): wire install and version commands into CLI |

## Next Phase Readiness

**Ready for 01-07 (Error recovery)**

Deployment infrastructure complete:
- Install wizard for all scenarios
- systemd service template for Linux servers
- Docker support for containerized deployment
- Version command for debugging

Remaining for Phase 1:
- Error recovery enhancement (01-07)
