# Phase 7: Resilience & Tooling - Research

**Researched:** 2026-01-30
**Domain:** Claude CLI transcript recovery, skills CLI cleanup, agent authoring
**Confidence:** HIGH

## Summary

Phase 7 addresses three distinct concerns: timeout recovery, skills CLI removal, and agent authoring. Research confirms:

1. **Timeout Recovery**: Claude CLI stores transcripts as JSONL files in `~/.claude/projects/` with directory names derived from cwd path (slashes → hyphens). Each line contains a `type` field; assistant responses have `type: "assistant"` with text in `message.content[0].text`.

2. **Skills Cleanup**: No official `npx skills` exists from Anthropic. Community alternatives include `npx openskills` and `npx ai-agent-skills`. Recommendation: Point to `npx openskills` (most mature, follows Anthropic's AgentSkills spec) or simply document manual installation to `~/.claude/skills/`.

3. **Agent Authoring**: Claude Code natively supports agents via markdown files in `~/.claude/agents/`. Files use YAML frontmatter (name, description, tools, model) + markdown body as system prompt. The `/agents` command provides interactive creation.

**Primary recommendation:** Implement transcript-based timeout recovery, remove `klausbot skills` CLI entirely, add agent authoring via natural language, update system prompt with agents folder reminder.

## Standard Stack

### Core

| Library          | Version  | Purpose                                       | Why Standard              |
| ---------------- | -------- | --------------------------------------------- | ------------------------- |
| Node.js fs       | built-in | File system operations for transcript reading | Native, no deps           |
| Node.js readline | built-in | JSONL line-by-line parsing                    | Native, handles streaming |
| Node.js path     | built-in | Path manipulation for transcript location     | Native path handling      |

### Supporting

| Library       | Version | Purpose | When to Use                                 |
| ------------- | ------- | ------- | ------------------------------------------- |
| (none needed) | -       | -       | All requirements met with Node.js built-ins |

### Alternatives Considered

| Instead of            | Could Use           | Tradeoff                                       |
| --------------------- | ------------------- | ---------------------------------------------- |
| readline for JSONL    | fs.readFile + split | readline handles memory better for large files |
| Manual agent creation | CLI wizard          | Natural language via Claude is simpler         |

**Installation:**

```bash
# No new dependencies required
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── daemon/
│   ├── spawner.ts       # Add timeout recovery logic
│   └── transcript.ts    # NEW: Transcript parser
├── cli/
│   └── index.ts         # Remove skills routing
├── memory/
│   └── context.ts       # Add agents folder reminder
└── index.ts             # Remove skills CLI case
```

### Pattern 1: Transcript Path Construction

**What:** Convert cwd to Claude's transcript directory path
**When to use:** When Claude times out, locate the most recent transcript
**Example:**

```typescript
// Source: Community analysis of ~/.claude/projects/ structure
function getTranscriptDir(cwd: string): string {
  // /home/user/klausbot → -home-user-klausbot
  const sanitized = cwd.replace(/^\//, "").replace(/\//g, "-");
  return path.join(os.homedir(), ".claude", "projects", `-${sanitized}`);
}
```

### Pattern 2: JSONL Parsing for Assistant Response

**What:** Parse transcript to extract last assistant response
**When to use:** After timeout, recover Claude's partial work
**Example:**

```typescript
// Source: DuckDB analysis blog, claude-code-transcripts repo
interface TranscriptEntry {
  type: "user" | "assistant" | "summary" | "system";
  message?: {
    content?: Array<{ type: string; text: string }>;
  };
  timestamp: string;
}

function extractLastAssistantResponse(transcriptPath: string): string | null {
  const lines = fs.readFileSync(transcriptPath, "utf-8").split("\n");
  let lastResponse: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const entry: TranscriptEntry = JSON.parse(line);
    if (entry.type === "assistant" && entry.message?.content?.[0]?.text) {
      lastResponse = entry.message.content[0].text;
    }
  }
  return lastResponse;
}
```

### Pattern 3: Agent File Creation

**What:** Create agent definition file from natural language description
**When to use:** When user wants to create custom agent
**Example:**

```typescript
// Source: Claude Code official docs
const agentTemplate = `---
name: ${name}
description: ${description}
tools: Read, Glob, Grep, Bash
model: inherit
---

${systemPrompt}
`;

const agentPath = path.join(os.homedir(), ".claude", "agents", `${name}.md`);
fs.writeFileSync(agentPath, agentTemplate);
```

### Anti-Patterns to Avoid

- **Parsing entire transcript into memory**: Use streaming/line-by-line for large files
- **Hardcoding transcript path**: Construct dynamically from cwd
- **Creating skills CLI replacement**: Just point to external tools

## Don't Hand-Roll

| Problem               | Don't Build          | Use Instead                 | Why                                    |
| --------------------- | -------------------- | --------------------------- | -------------------------------------- |
| Skills installation   | Custom installer     | `npx openskills` or manual  | Community tools are mature, maintained |
| Agent creation wizard | Interactive CLI      | Natural language via Claude | Claude already supports this natively  |
| JSONL streaming       | Custom stream parser | Node readline               | Built-in handles backpressure          |

**Key insight:** Claude Code already has comprehensive agents support. Don't duplicate - just expose in system prompt.

## Common Pitfalls

### Pitfall 1: Transcript File Selection

**What goes wrong:** Multiple session files exist; picking wrong one
**Why it happens:** Claude CLI creates new files per session
**How to avoid:** Sort by modification time, get most recent `chat_*.jsonl`
**Warning signs:** Recovered response doesn't match current conversation

### Pitfall 2: Incomplete Transcript on Timeout

**What goes wrong:** Transcript may not have final response if killed mid-stream
**Why it happens:** SIGTERM may interrupt before flush
**How to avoid:** Parse what exists, inform user if incomplete
**Warning signs:** Last entry is tool use without result

### Pitfall 3: Path Encoding Edge Cases

**What goes wrong:** Special characters in cwd break path construction
**Why it happens:** Spaces, unicode, or unusual characters in path
**How to avoid:** Test with paths containing spaces, dots, hyphens
**Warning signs:** `ENOENT` errors on transcript lookup

### Pitfall 4: Agent Name Collisions

**What goes wrong:** User creates agent with name that already exists
**Why it happens:** No collision check before write
**How to avoid:** Check if file exists, prompt for overwrite
**Warning signs:** Existing agent silently overwritten

## Code Examples

### Finding Most Recent Transcript

```typescript
// Source: Verified pattern from community tools
function findLatestTranscript(projectDir: string): string | null {
  if (!fs.existsSync(projectDir)) return null;

  const files = fs
    .readdirSync(projectDir)
    .filter((f) => f.startsWith("chat_") && f.endsWith(".jsonl"))
    .map((f) => ({
      name: f,
      path: path.join(projectDir, f),
      mtime: fs.statSync(path.join(projectDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].path : null;
}
```

### System Prompt Addition for Agents

```typescript
// Extend getSkillReminder() or add new function
export function getAgentReminder(): string {
  return `<agent-folder>
Agents live in ~/.claude/agents/ - create and save agents there.
Use YAML frontmatter: name, description, tools, model.
Body is the system prompt.
</agent-folder>`;
}
```

### Transcript Recovery Flow

```typescript
async function handleTimeout(cwd: string): Promise<string | null> {
  const transcriptDir = getTranscriptDir(cwd);
  const transcriptPath = findLatestTranscript(transcriptDir);

  if (!transcriptPath) {
    return null; // No transcript found
  }

  const response = extractLastAssistantResponse(transcriptPath);
  if (response) {
    return `[Recovered from timeout]\n\n${response}`;
  }
  return null;
}
```

## State of the Art

| Old Approach             | Current Approach            | When Changed            | Impact                         |
| ------------------------ | --------------------------- | ----------------------- | ------------------------------ |
| `klausbot skills browse` | `npx openskills install`    | Community adoption 2025 | External tool handles registry |
| Custom agent CLI         | `/agents` command in Claude | Claude Code native      | Built-in interactive creation  |
| Timeout = lost work      | Transcript recovery         | This phase              | Preserves partial Claude work  |

**Deprecated/outdated:**

- `klausbot skills` CLI: Being removed this phase (success criterion 3)
- Manual skill folder creation: External tools handle this better

## Open Questions

1. **Transcript session matching**
   - What we know: Transcripts are in `chat_*.jsonl` files sorted by mtime
   - What's unclear: Exact session ID correlation with spawner session_id
   - Recommendation: Use most recent file; session ID matching is nice-to-have

2. **npx skills vs manual**
   - What we know: No official Anthropic `npx skills` exists
   - What's unclear: Which community tool to recommend
   - Recommendation: Document `npx openskills` OR simply point to `~/.claude/skills/` manual install

3. **Agent creation UX**
   - What we know: Claude can create agents natively via `/agents`
   - What's unclear: Whether to build natural language → agent or just remind about `/agents`
   - Recommendation: System prompt reminder + let Claude use native `/agents` internally

## Sources

### Primary (HIGH confidence)

- [Claude Code Subagents Docs](https://code.claude.com/docs/en/sub-agents) - Agent file format, frontmatter fields
- [Claude Code Skills Docs](https://code.claude.com/docs/en/skills) - Skills folder location, no official npx

### Secondary (MEDIUM confidence)

- [DuckDB Log Analysis](https://liambx.com/blog/claude-code-log-analysis-with-duckdb) - JSONL field structure
- [claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) - Transcript location, parsing
- [claude-conversation-extractor](https://github.com/ZeroSumQuant/claude-conversation-extractor) - File patterns `chat_*.jsonl`

### Tertiary (LOW confidence)

- WebSearch for `npx skills` - Confirmed no official package exists

## Metadata

**Confidence breakdown:**

- Transcript recovery: HIGH - Multiple community tools validate format
- Skills CLI removal: HIGH - Straightforward code removal
- Agent authoring: HIGH - Official docs confirm native support
- `npx skills` recommendation: MEDIUM - Community tools exist, no official one

**Research date:** 2026-01-30
**Valid until:** 60 days (Claude CLI transcript format stable)
