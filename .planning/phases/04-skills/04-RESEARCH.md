# Phase 4: Skills - Research

**Researched:** 2026-01-29
**Domain:** Claude Code skills system, Telegram bot command registration, proactive skill creation
**Confidence:** HIGH (verified via Claude Code official docs, Anthropic skills repo, moltbot reference)

## Summary

Phase 4 implements an extensible skills system where Claude selects and executes reusable skills from `~/.claude/skills/`. Research confirms Claude Code's skills follow the Agent Skills open standard with YAML frontmatter + markdown instructions. The skill-creator from Anthropic's official repository provides the primary mechanism for creating new skills.

Key architectural insight: Claude's skill selection uses pure LLM reasoning via the `Skill` tool - no algorithmic routing or intent classification. Skill descriptions are loaded into context (15k char budget default), and Claude's language model decides when to invoke based on matching user intent to descriptions.

Telegram command registration via `setMyCommands` API enables skills to appear in the `/` menu. Commands must use lowercase + underscores only (no hyphens). Both `/skill <name>` and `/<skillname>` invocation patterns are supported.

**Primary recommendation:** Follow Claude Code standard skill format (`~/.claude/skills/<name>/SKILL.md`). Ship skill-creator as mandatory pre-installed skill. Add skill descriptions to system prompt for auto-selection. Register skill names as Telegram commands. Detect repeated patterns via conversation log analysis.

## Standard Stack

### Core (No New Dependencies)

Phase 4 uses existing stack. Skills are markdown files - no runtime libraries needed.

| Component      | Version         | Purpose                       | Notes                       |
| -------------- | --------------- | ----------------------------- | --------------------------- |
| SKILL.md files | Agent Skills v1 | Skill definitions             | YAML frontmatter + markdown |
| fs module      | built-in        | Skill discovery/loading       | readFileSync, readdirSync   |
| path module    | built-in        | Path resolution               | join, basename              |
| grammy         | 1.x (existing)  | Telegram command registration | setMyCommands API           |

### Skill Format (Agent Skills Standard)

```yaml
---
name: skill-name
description: What this skill does and when Claude should use it
---
# Skill Instructions

[Markdown instructions Claude follows when skill is invoked]
```

**Required fields:**

- `name`: lowercase, hyphens/underscores only, max 64 chars
- `description`: Trigger criteria - Claude reads this to decide when to use skill

**Optional fields:**

- `disable-model-invocation: true` - User-only (not auto-selected)
- `user-invocable: false` - Claude-only (not in slash menu)
- `allowed-tools` - Restrict Claude's tool access when skill active
- `argument-hint` - Show in autocomplete (e.g., `[issue-number]`)

### Alternatives Considered

| Instead of                | Could Use          | Tradeoff                                     |
| ------------------------- | ------------------ | -------------------------------------------- |
| SKILL.md format           | Custom JSON schema | Lose ecosystem compatibility                 |
| LLM-based selection       | Keyword matching   | Lose semantic understanding, false positives |
| Per-message skill loading | Startup-only load  | Lose hot reload, gain simplicity             |

**Installation (no runtime deps):**

```bash
# Skills are markdown files, no packages needed
# Skill-creator installs from Anthropic's repo:
mkdir -p ~/.claude/skills/skill-creator
curl -o ~/.claude/skills/skill-creator/SKILL.md \
  https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md
```

## Architecture Patterns

### Skills Directory Structure (Standard Claude Code Location)

```
~/.claude/
  skills/                   # Standard Claude Code skills location (we read, don't own)
    skill-creator/          # MANDATORY - pre-installed by klausbot
      SKILL.md
    summarize/              # Example zero-dep skill
      SKILL.md
    <skill-name>/           # User-created skills
      SKILL.md
      scripts/              # Optional executable scripts
      references/           # Optional documentation
      assets/               # Optional templates/output files
```

Note: We use the standard Claude Code skills directory, not a klausbot-specific one. This ensures compatibility with Claude Code CLI and other tools.

### Pattern 1: Skill Discovery and Loading

**What:** Scan `~/.claude/skills/` for SKILL.md files, load descriptions into context.

**Source:** [Claude Code Skills Docs](https://code.claude.com/docs/en/skills)

**Example:**

```typescript
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml"; // Or simple regex extraction

interface SkillMeta {
  name: string;
  description: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
}

const SKILLS_DIR = join(homedir(), ".claude", "skills");
const SKILLS_CHAR_BUDGET = 15000; // Default context budget

function extractFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  // Simple YAML parsing (or use yaml library)
  const lines = match[1].split("\n");
  const result: Record<string, string> = {};
  for (const line of lines) {
    const [key, ...valueParts] = line.split(":");
    if (key && valueParts.length) {
      result[key.trim()] = valueParts.join(":").trim();
    }
  }
  return result;
}

function discoverSkills(): SkillMeta[] {
  if (!existsSync(SKILLS_DIR)) return [];

  const skills: SkillMeta[] = [];
  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = join(SKILLS_DIR, entry.name, "SKILL.md");
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, "utf-8");
    const frontmatter = extractFrontmatter(content);

    if (!frontmatter?.description) continue; // Skip skills without description

    skills.push({
      name: String(frontmatter.name ?? entry.name),
      description: String(frontmatter.description),
      disableModelInvocation:
        frontmatter["disable-model-invocation"] === "true",
      userInvocable: frontmatter["user-invocable"] !== "false",
    });
  }

  return skills;
}

function buildSkillsContext(skills: SkillMeta[]): string {
  const autoSelectableSkills = skills.filter((s) => !s.disableModelInvocation);

  let context = "<available_skills>\n";
  let charCount = context.length;

  for (const skill of autoSelectableSkills) {
    const entry = `"${skill.name}": ${skill.description}\n`;
    if (charCount + entry.length > SKILLS_CHAR_BUDGET) break;
    context += entry;
    charCount += entry.length;
  }

  context += "</available_skills>";
  return context;
}
```

**Confidence:** HIGH - follows official Claude Code implementation pattern.

### Pattern 2: Telegram Command Registration

**What:** Register skill names as bot commands via setMyCommands API.

**Source:** [Telegram Bot API](https://core.telegram.org/api/bots/commands), [moltbot Telegram](https://docs.molt.bot/channels/telegram)

**Constraint:** Command names must be lowercase + underscores only (no hyphens). 1-32 chars.

**Example:**

```typescript
import type { Bot, BotCommand } from "grammy";

function normalizeCommandName(skillName: string): string {
  // skill-name -> skill_name (Telegram requirement)
  return skillName.toLowerCase().replace(/-/g, "_").slice(0, 32);
}

async function registerSkillCommands(
  bot: Bot,
  skills: SkillMeta[],
): Promise<void> {
  const commands: BotCommand[] = [
    // Built-in commands first
    { command: "start", description: "Start or check pairing status" },
    { command: "help", description: "Show available commands" },
    { command: "status", description: "Show queue status" },
    { command: "skill", description: "Run a skill: /skill <name> [args]" },
  ];

  // Add user-invocable skills
  const invocableSkills = skills.filter((s) => s.userInvocable !== false);

  for (const skill of invocableSkills) {
    const cmdName = normalizeCommandName(skill.name);
    // Telegram description max 256 chars
    const desc =
      skill.description.slice(0, 250) +
      (skill.description.length > 250 ? "..." : "");

    // Avoid duplicate commands
    if (!commands.some((c) => c.command === cmdName)) {
      commands.push({ command: cmdName, description: desc });
    }
  }

  // Telegram limit: 100 commands max
  const limitedCommands = commands.slice(0, 100);

  await bot.api.setMyCommands(limitedCommands);
}
```

**Confidence:** HIGH - Telegram API well-documented, moltbot pattern verified.

### Pattern 3: Skill Invocation (Dual Pattern)

**What:** Support both `/skill <name> [args]` and `/<skillname> [args]`.

**Example:**

```typescript
import type { Context } from "grammy";

// Handler for /skill command
async function handleSkillCommand(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? "";
  const parts = text.split(/\s+/);
  const skillName = parts[1];
  const args = parts.slice(2).join(" ");

  if (!skillName) {
    await ctx.reply(
      "Usage: /skill <name> [args]\n\nAvailable skills:\n" +
        skills.map((s) => `- ${s.name}`).join("\n"),
    );
    return;
  }

  await invokeSkill(ctx, skillName, args);
}

// Handler for direct skill commands (/<skillname>)
async function handleDirectSkillCommand(
  ctx: Context,
  skillName: string,
  args: string,
): Promise<void> {
  await invokeSkill(ctx, skillName, args);
}

async function invokeSkill(
  ctx: Context,
  skillName: string,
  args: string,
): Promise<void> {
  const skill = skills.find(
    (s) =>
      s.name === skillName ||
      normalizeCommandName(s.name) === normalizeCommandName(skillName),
  );

  if (!skill) {
    await ctx.reply(`Unknown skill: ${skillName}`);
    return;
  }

  // Load full skill content
  const skillPath = join(SKILLS_DIR, skill.name, "SKILL.md");
  const content = readFileSync(skillPath, "utf-8");
  const instructions = content.replace(/^---[\s\S]*?---\n*/, ""); // Remove frontmatter

  // Replace $ARGUMENTS placeholder
  const prompt = args
    ? instructions.replace(/\$ARGUMENTS/g, args)
    : instructions +
      (instructions.includes("$ARGUMENTS") ? "" : `\n\nARGUMENTS: ${args}`);

  // Spawn Claude with skill prompt as additional instruction
  const response = await queryClaudeCode(ctx.message?.text ?? "", {
    additionalInstructions: `<skill name="${skill.name}">\n${prompt}\n</skill>`,
  });

  await ctx.reply(response.result);
}
```

**Confidence:** HIGH - follows moltbot dual invocation pattern.

### Pattern 4: Proactive Skill Suggestion

**What:** Detect repeated patterns in conversations, suggest skill creation.

**Source:** CONTEXT.md decision: "Claude proactively suggests skill creation after recognizing repeated patterns"

**Implementation approach:**

```typescript
/**
 * Pattern detection for proactive skill suggestions
 *
 * Strategy: Analyze recent conversation logs for repeated task patterns.
 * Trigger suggestion when same task type appears 3+ times in 7 days.
 */

interface TaskPattern {
  description: string;
  count: number;
  lastSeen: string;
  examples: string[];
}

function getSkillSuggestionInstructions(): string {
  return `
<skill-creation-awareness>
## Proactive Skill Creation

When you notice the user repeatedly asking for similar tasks (3+ times), consider suggesting:

"I've noticed you often ask me to [task pattern]. Would you like me to create a skill for this so it's faster next time?"

### Patterns That Indicate Skill Potential

- Same type of transformation (e.g., "summarize this", "format as...")
- Repeated workflows (e.g., "check X then do Y")
- Consistent output formats requested
- Similar tool sequences used repeatedly

### How to Suggest

1. **Observe**: Note when similar tasks recur
2. **Suggest naturally**: "This seems like something we do often. Want me to turn this into a reusable skill?"
3. **If approved**: Use /skill-creator to build and install the skill
4. **Test**: Verify the skill works, then mention it's ready

Never create skills without asking first. The user may prefer case-by-case handling.
</skill-creation-awareness>`;
}
```

**Confidence:** MEDIUM - pattern detection relies on Claude's reasoning, no algorithmic verification.

### Pattern 5: Skill Creation via skill-creator

**What:** Use Anthropic's official skill-creator skill to create new skills.

**Source:** [anthropics/skills repository](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)

**Flow:**

1. User approves skill creation suggestion
2. Claude invokes `/skill-creator` or uses it via natural language
3. skill-creator guides through: understanding examples, planning contents, initializing, editing, packaging
4. New skill written to `~/.claude/skills/<name>/SKILL.md`
5. Skills auto-discovered on next invocation (or hot-reload if implemented)

**Confidence:** HIGH - official Anthropic skill, well-documented process.

### Anti-Patterns to Avoid

- **Keyword-based skill routing:** Use LLM understanding, not regex/keyword matching
- **Loading all skill content into context:** Only load descriptions; full content on invocation
- **Hyphenated Telegram commands:** Use underscores - hyphens cause BOT_COMMAND_INVALID error
- **Creating skills without user approval:** Always ask first, respect user agency
- **Skills with external dependencies:** Phase 4 scoped to zero-dep skills only

## Don't Hand-Roll

| Problem               | Don't Build                     | Use Instead                | Why                                             |
| --------------------- | ------------------------------- | -------------------------- | ----------------------------------------------- |
| Skill authoring       | Custom skill format             | Anthropic's skill-creator  | Official tool, maintains standard compliance    |
| Intent classification | ML classifier, keyword matching | Claude's LLM reasoning     | Semantic understanding, no training data needed |
| YAML parsing          | Custom parser                   | Simple regex or `yaml` lib | Frontmatter is simple key: value                |
| Command menu          | Manual BotFather                | setMyCommands API          | Programmatic, auto-updates                      |

**Key insight:** The power of Phase 4 comes from Claude's native skill selection capability. Build the scaffolding (discovery, loading, invocation) but let Claude's LLM handle the intelligence.

## Common Pitfalls

### Pitfall 1: Telegram Command Name Validation

**What goes wrong:** `setMyCommands` fails with BOT_COMMAND_INVALID error.
**Why it happens:** Skill names contain hyphens (e.g., `skill-creator`).
**How to avoid:** Normalize names: `skill-creator` -> `skill_creator`.
**Warning signs:** Startup errors mentioning "BOT_COMMAND_INVALID".

### Pitfall 2: Skills Exceed Context Budget

**What goes wrong:** Claude doesn't "see" some skills, ignores them.
**Why it happens:** Total skill descriptions exceed 15k char budget.
**How to avoid:** Keep descriptions concise. Prioritize skills by frequency. Truncate if needed.
**Warning signs:** User invokes skill Claude claims doesn't exist.

### Pitfall 3: Skill Instructions Too Long

**What goes wrong:** Context window bloat, slow responses, instruction ignored.
**Why it happens:** SKILL.md body exceeds 500 lines / 5k words.
**How to avoid:** Follow progressive disclosure - move details to `references/` folder.
**Warning signs:** Large token counts, partial instruction following.

### Pitfall 4: Missing Description Field

**What goes wrong:** Skill never auto-selected, doesn't appear in discovery.
**Why it happens:** SKILL.md lacks `description:` in frontmatter.
**How to avoid:** Validate frontmatter has required fields during discovery.
**Warning signs:** Skill exists but Claude never suggests using it.

### Pitfall 5: Proactive Creation Without Consent

**What goes wrong:** User annoyed by unsolicited skill creation.
**Why it happens:** Claude creates skill without asking.
**How to avoid:** Always suggest first, wait for explicit approval.
**Warning signs:** User confusion about new commands appearing.

### Pitfall 6: Hot Reload Race Conditions

**What goes wrong:** Newly created skill not available immediately.
**Why it happens:** Skills cached at startup, no refresh mechanism.
**How to avoid:** Phase 4 simplification: restart-required or implement explicit `/reload` command.
**Warning signs:** "Skill not found" immediately after creation.

## Code Examples

### Complete Skill System Integration

```typescript
// src/skills/loader.ts
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { KLAUSBOT_HOME } from "../memory/home.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("skills");

export interface SkillMeta {
  name: string;
  description: string;
  path: string;
  disableModelInvocation: boolean;
  userInvocable: boolean;
}

const SKILLS_DIR = join(homedir(), ".claude", "skills");

/**
 * Discover all skills from ~/.claude/skills/
 */
export function discoverSkills(): SkillMeta[] {
  if (!existsSync(SKILLS_DIR)) {
    log.info("Skills directory not found, creating");
    return [];
  }

  const skills: SkillMeta[] = [];

  try {
    const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = join(SKILLS_DIR, entry.name);
      const skillPath = join(skillDir, "SKILL.md");

      if (!existsSync(skillPath)) {
        log.debug({ skill: entry.name }, "No SKILL.md found, skipping");
        continue;
      }

      const content = readFileSync(skillPath, "utf-8");
      const meta = parseSkillMeta(content, entry.name, skillPath);

      if (meta) {
        skills.push(meta);
        log.info({ skill: meta.name }, "Discovered skill");
      }
    }
  } catch (err) {
    log.error({ err }, "Failed to discover skills");
  }

  return skills;
}

function parseSkillMeta(
  content: string,
  dirName: string,
  path: string,
): SkillMeta | null {
  // Extract YAML frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = match[1];

  // Parse YAML fields (simple implementation)
  const getName = () => {
    const m = frontmatter.match(/^name:\s*(.+)$/m);
    return m ? m[1].trim() : dirName;
  };

  const getDescription = () => {
    const m = frontmatter.match(/^description:\s*(.+)$/m);
    return m ? m[1].trim() : "";
  };

  const getBoolean = (key: string, defaultValue: boolean) => {
    const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    if (!m) return defaultValue;
    return m[1].trim().toLowerCase() === "true";
  };

  const description = getDescription();
  if (!description) {
    log.warn({ path }, "Skill missing description, skipping");
    return null;
  }

  return {
    name: getName(),
    description,
    path,
    disableModelInvocation: getBoolean("disable-model-invocation", false),
    userInvocable: getBoolean("user-invocable", true),
  };
}

/**
 * Load full skill content for invocation
 */
export function loadSkillContent(skill: SkillMeta): string {
  const content = readFileSync(skill.path, "utf-8");
  // Remove frontmatter, return body
  return content.replace(/^---[\s\S]*?---\n*/, "");
}

/**
 * Build skills context for system prompt (descriptions only)
 */
export function buildSkillsContext(skills: SkillMeta[]): string {
  const autoSelectable = skills.filter((s) => !s.disableModelInvocation);

  if (autoSelectable.length === 0) return "";

  const lines = autoSelectable.map((s) => `- "${s.name}": ${s.description}`);

  return `<available_skills>
## Skills You Can Use

When a user's request matches one of these skills, consider using it:

${lines.join("\n")}

To use a skill, the user can say "/skill <name>" or "/<name>", or you can suggest using it when relevant.
</available_skills>`;
}
```

### Skill Registry File Format (Optional - Not Implemented in Phase 4)

```typescript
// Optional registry for tracking skill metadata (not implemented in Phase 4)
// Skills are discovered directly from ~/.claude/skills/ directory
interface SkillRegistry {
  /** Version of registry format */
  version: 1;

  /** Installed skills metadata (cache of discovered skills) */
  installed: {
    [name: string]: {
      installedAt: string; // ISO date
      source: "builtin" | "user" | "curated";
      lastUsed?: string; // ISO date
      useCount: number;
    };
  };

  /** Curated skills available for installation */
  curated: {
    name: string;
    description: string;
    source: string; // URL or local path
    category: "productivity" | "information" | "utilities";
  }[];
}
```

### Pre-installed Skills (Zero-Dependency)

Based on research, these skills from moltbot/awesome-moltbot-skills work without external deps:

| Skill           | Description                     | Category     |
| --------------- | ------------------------------- | ------------ |
| skill-creator   | Create new skills interactively | Utilities    |
| summarize       | Condense text content           | Information  |
| frontend-design | UI/design creation              | Productivity |
| session-logs    | Activity tracking               | Utilities    |

**Recommendation:** Ship with `skill-creator` mandatory. Others optional via `klausbot skills` CLI picker.

### CLI Skills Picker

```typescript
// src/cli/skills.ts
import { select } from "@inquirer/prompts";
import { copySync, existsSync, mkdirSync } from "fs-extra";
import { join } from "path";

interface CuratedSkill {
  name: string;
  description: string;
  source: string;
}

const CURATED_SKILLS: CuratedSkill[] = [
  {
    name: "summarize",
    description: "Condense text content (zero dependencies)",
    source:
      "https://raw.githubusercontent.com/anthropics/skills/main/skills/summarize/SKILL.md",
  },
  // Add more curated zero-dep skills
];

export async function installSkillsInteractive(): Promise<void> {
  const choices = CURATED_SKILLS.map((s) => ({
    name: `${s.name} - ${s.description}`,
    value: s.name,
  }));

  const selected = await select({
    message: "Select skills to install:",
    choices,
  });

  // Install selected skill
  const skill = CURATED_SKILLS.find((s) => s.name === selected);
  if (skill) {
    await installSkill(skill);
    console.log(`Installed: ${skill.name}`);
  }
}
```

## State of the Art

| Old Approach            | Current Approach          | When Changed    | Impact                    |
| ----------------------- | ------------------------- | --------------- | ------------------------- |
| Custom plugin formats   | Agent Skills standard     | Dec 2025        | Cross-tool compatibility  |
| Keyword intent matching | LLM-based selection       | Agent Skills v1 | Semantic understanding    |
| Manual BotFather setup  | setMyCommands API         | Always          | Programmatic registration |
| Global skill repos      | Personal + project skills | Claude Code 2.x | Local-first, portable     |

**Current best practices:**

- Use Agent Skills format for ecosystem compatibility
- Keep skill descriptions in context, full content loaded on-demand
- Progressive disclosure: metadata -> body -> resources
- Underscore not hyphen for Telegram commands
- Ask before creating skills proactively

**Deprecated/outdated:**

- Custom JSON skill schemas (use YAML frontmatter + markdown)
- Intent classifiers (LLM handles semantic matching)
- Monolithic skill files (use references/ for detailed content)

## Open Questions

1. **Hot reload mechanism**
   - What we know: Skills discoverable at startup
   - What's unclear: How to refresh without restart after skill creation
   - Recommendation: Phase 4 accepts restart-required; hot reload in future phase

2. **Skill version management**
   - What we know: Skills are local files
   - What's unclear: How to handle updates to curated skills
   - Recommendation: Store `installedAt` in registry, manual update via CLI

3. **Pattern detection accuracy**
   - What we know: Claude can recognize repeated patterns
   - What's unclear: How reliably, what threshold (3 times? 5 times?)
   - Recommendation: Start with suggestion after 3 similar requests in 7 days, tune empirically

4. **Skill sharing between instances**
   - What we know: Skills are local to `~/.claude/skills/`
   - What's unclear: How to share skills between machines
   - Recommendation: Out of scope for Phase 4; manual file copy for now

## Sources

### Primary (HIGH confidence)

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - Official skill format, invocation, configuration
- [anthropics/skills repository](https://github.com/anthropics/skills) - skill-creator, template, reference implementations
- [Claude Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) - Implementation details on Skill tool mechanism

### Secondary (MEDIUM confidence)

- [moltbot Telegram](https://docs.molt.bot/channels/telegram) - setMyCommands usage, command normalization
- [moltbot Skills](https://docs.molt.bot/tools/skills) - Skill discovery, loading patterns
- [VoltAgent/awesome-moltbot-skills](https://github.com/VoltAgent/awesome-moltbot-skills) - Skill catalog, dependency analysis

### Tertiary (LOW confidence - needs validation)

- Proactive pattern detection thresholds - requires empirical testing
- Hot reload implementation - deferred, needs design
- Skill context budget optimization - monitor in production

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Agent Skills is well-documented open standard
- Architecture patterns: HIGH - follows Claude Code + moltbot proven patterns
- Pitfalls: MEDIUM - some require production validation (context budget, pattern detection)
- Code examples: HIGH - derived from official implementations

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - Agent Skills standard stable)
