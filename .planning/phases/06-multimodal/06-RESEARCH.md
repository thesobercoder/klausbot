# Phase 6: Multimodal - Research

**Researched:** 2026-01-30
**Domain:** Voice transcription (Whisper) + Image analysis (Claude vision)
**Confidence:** HIGH

## Summary

Phase 6 adds voice message transcription and image analysis to klausbot. Two distinct pipelines are needed:

1. **Voice**: Download OGG file from Telegram, send to OpenAI Whisper API for transcription, pass transcript text to Claude Code
2. **Images**: Download image from Telegram, save to `~/.klausbot/images/{date}/`, instruct Claude Code to read the file via its Read tool

Key insight: Claude Code CLI in `-p` (print) mode cannot receive images directly via command line. Images must be saved to disk and referenced by path in the prompt. Claude Code's built-in Read tool can read image files (JPEG, PNG, GIF, WebP) and analyze them using vision capabilities.

**Primary recommendation:** Extend `QueuedMessage` to include media attachments. Process media before calling Claude Code - voice becomes text transcript, images become file paths embedded in prompt.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library           | Version | Purpose                   | Why Standard                       |
| ----------------- | ------- | ------------------------- | ---------------------------------- |
| `openai`          | ^6.17.0 | Whisper API transcription | Already in codebase for embeddings |
| `grammy`          | ^1.34.1 | Telegram bot framework    | Already in codebase                |
| `@grammyjs/files` | ^1.2.0  | File download helper      | Official grammY plugin             |

### Supporting

| Library          | Version  | Purpose                | When to Use               |
| ---------------- | -------- | ---------------------- | ------------------------- |
| Node.js `fs`     | built-in | File system operations | Saving images, temp files |
| Node.js `path`   | built-in | Path manipulation      | Constructing image paths  |
| Node.js `crypto` | built-in | UUID generation        | Unique filenames          |

### Alternatives Considered

| Instead of      | Could Use         | Tradeoff                                             |
| --------------- | ----------------- | ---------------------------------------------------- |
| @grammyjs/files | Manual fetch      | Plugin handles edge cases (URL expiry, Bot API auth) |
| Whisper API     | Local whisper.cpp | Local requires GPU, 1-2GB model, slower              |

**Installation:**

```bash
npm install @grammyjs/files
```

Note: `openai` package already installed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── media/                    # New module for media processing
│   ├── index.ts              # Exports
│   ├── download.ts           # Telegram file download helpers
│   ├── transcribe.ts         # Whisper API transcription
│   └── storage.ts            # Image storage management
├── telegram/
│   └── handlers.ts           # Extended for voice/photo messages
├── daemon/
│   ├── queue.ts              # Extended QueuedMessage type
│   └── gateway.ts            # Extended message processing
```

### Pattern 1: Media-Aware Queue Message

**What:** Extend QueuedMessage to carry media metadata alongside text
**When to use:** All media processing flows
**Example:**

```typescript
// Extend existing QueuedMessage
export interface MediaAttachment {
  type: "voice" | "photo";
  fileId: string; // Telegram file_id
  localPath?: string; // After download: /path/to/file
  transcript?: string; // For voice: transcription result
  mimeType?: string; // e.g., 'audio/ogg', 'image/jpeg'
  processingTimeMs?: number;
}

export interface QueuedMessage {
  // ... existing fields
  text: string;
  media?: MediaAttachment[]; // New field
}
```

### Pattern 2: Pre-Processing Pipeline

**What:** Process all media before calling Claude Code
**When to use:** Message handler flow
**Example:**

```typescript
// In gateway.ts processMessage()
async function processMessage(msg: QueuedMessage): Promise<void> {
  // 1. Process voice → transcript (replaces text if voice-only)
  // 2. Process images → save to disk, get paths
  // 3. Build prompt with media context
  // 4. Call Claude Code with enriched prompt
}
```

### Pattern 3: Prompt Enhancement for Images

**What:** Instruct Claude Code to read image files via its Read tool
**When to use:** When message includes images
**Example:**

```typescript
// Build prompt with image references
function buildPromptWithImages(text: string, imagePaths: string[]): string {
  if (imagePaths.length === 0) return text;

  const imageInstructions = imagePaths
    .map((p, i) => `Image ${i + 1}: ${p}`)
    .join("\n");

  return `The user sent ${imagePaths.length} image(s). Read and analyze them:
${imageInstructions}

User's message: ${text || "(no text, just the image(s))"}`;
}
```

### Anti-Patterns to Avoid

- **Base64 in prompt:** Don't embed base64 image data in prompt text - it won't work with Claude Code CLI
- **Blocking downloads:** Don't download files synchronously - use async/await with proper error handling
- **Unbounded retries:** Don't retry indefinitely - cap at 3 retries with exponential backoff
- **Storing large audio:** Don't keep voice files after transcription - delete after successful processing

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                | Don't Build                        | Use Instead                         | Why                                          |
| ---------------------- | ---------------------------------- | ----------------------------------- | -------------------------------------------- |
| Telegram file download | Manual fetch with URL construction | @grammyjs/files plugin              | Handles Bot API auth, URL expiry, edge cases |
| Audio transcription    | Local Whisper model                | OpenAI Whisper API                  | Simpler, no GPU needed, better accuracy      |
| Retry logic            | Custom retry loop                  | Simple exponential backoff utility  | Well-understood pattern                      |
| Image MIME detection   | Manual header parsing              | Trust Telegram's provided mime_type | Telegram already validates                   |

**Key insight:** Telegram's Bot API and OpenAI's Whisper API handle most complexity. Don't re-implement validation they already do.

## Common Pitfalls

### Pitfall 1: Telegram File URL Expiry

**What goes wrong:** File download URL expires after ~1 hour
**Why it happens:** Bot API URLs are temporary for security
**How to avoid:** Download immediately after `getFile()` call, don't store URLs
**Warning signs:** "File not found" errors on delayed processing

### Pitfall 2: Voice Message Format Confusion

**What goes wrong:** Assuming Telegram sends MP3 or WAV
**Why it happens:** Telegram uses OGG Opus container format
**How to avoid:** Whisper API accepts OGG directly - no conversion needed
**Warning signs:** Code that converts audio unnecessarily

### Pitfall 3: Claude Code Image Path Issues

**What goes wrong:** Claude Code can't find image file
**Why it happens:** Using relative paths or paths outside Claude Code's working directory
**How to avoid:** Use absolute paths within `~/.klausbot/` (Claude Code's cwd)
**Warning signs:** "File not found" in Claude Code output

### Pitfall 4: Missing OPENAI_API_KEY Handling

**What goes wrong:** Silent failures when API key missing
**Why it happens:** Not checking key availability at startup
**How to avoid:** Log capability status at gateway startup, graceful degradation
**Warning signs:** Users confused why voice/images aren't working

### Pitfall 5: Large Image Files

**What goes wrong:** Claude vision struggles with huge images
**Why it happens:** Images over 5MB or 8000x8000px get rejected or slow
**How to avoid:** Log warnings for large files, let Claude's Read tool handle
**Warning signs:** Slow responses, vision errors

## Code Examples

Verified patterns from official sources:

### Download Voice Message (grammY)

```typescript
// Source: https://grammy.dev/guide/files
import { hydrateFiles } from "@grammyjs/files";

// Apply plugin to bot
bot.api.config.use(hydrateFiles(bot.token));

// Handle voice messages
bot.on("message:voice", async (ctx) => {
  const file = await ctx.getFile();
  const localPath = await file.download(); // Downloads to temp dir
  // localPath is now a local file path
});
```

### Download Photo (grammY)

```typescript
// Source: https://grammy.dev/guide/files
bot.on("message:photo", async (ctx) => {
  // Get largest photo (last in array)
  const photos = ctx.message.photo;
  const largest = photos[photos.length - 1];

  const file = await ctx.api.getFile(largest.file_id);
  const localPath = await file.download("/custom/path/image.jpg");
});
```

### Transcribe with Whisper API

```typescript
// Source: OpenAI documentation
import OpenAI from "openai";
import { createReadStream } from "fs";

const openai = new OpenAI();

async function transcribe(audioPath: string): Promise<string> {
  const transcription = await openai.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: "whisper-1",
    // language: 'en',  // Optional: auto-detect if omitted
  });
  return transcription.text;
}
```

### Claude Vision via Read Tool

```typescript
// How Claude Code CLI handles images (from Claude Code docs)
// The Read tool can read image files and analyze them

// In your prompt to Claude Code:
const prompt = `Please analyze the image at ${imagePath} and describe what you see.`;

// Claude Code will use its Read tool internally:
// Read({ file_path: imagePath }) → returns image for vision analysis
```

### Exponential Backoff Retry

```typescript
// Standard pattern for transient failures
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry non-transient errors
      if (!isTransientError(lastError)) throw lastError;

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError!;
}

function isTransientError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("rate limit") ||
    msg.includes("503") ||
    msg.includes("429")
  );
}
```

## State of the Art

| Old Approach                         | Current Approach         | When Changed                 | Impact                              |
| ------------------------------------ | ------------------------ | ---------------------------- | ----------------------------------- |
| Local Whisper models                 | Whisper API (hosted)     | 2023                         | Simpler deployment, better accuracy |
| FFmpeg conversion for Telegram audio | Direct OGG to Whisper    | Whisper always supported OGG | No conversion needed                |
| Separate vision API calls            | Claude's built-in vision | Claude 3 (2024)              | Unified model, simpler code         |

**Deprecated/outdated:**

- Manual audio format conversion: Whisper API accepts OGG directly
- Separate Claude vision API: Claude Code's Read tool handles images

## Open Questions

Things that couldn't be fully resolved:

1. **Image storage cleanup policy**
   - What we know: CONTEXT.md says keep images, store in `~/.klausbot/images/{date}/`
   - What's unclear: How long to keep? Any cleanup needed?
   - Recommendation: Start with no cleanup, add later if storage becomes issue

2. **Claude Code Read tool confidence for images**
   - What we know: Read tool can read images, Claude analyzes them
   - What's unclear: Exact error messages when Read fails on image
   - Recommendation: Test with actual images, capture error patterns

3. **Multiple images ordering**
   - What we know: Can send multiple images to Claude
   - What's unclear: Does order in prompt matter for analysis?
   - Recommendation: Number images in prompt ("Image 1:", "Image 2:")

## Sources

### Primary (HIGH confidence)

- [grammY File Handling Guide](https://grammy.dev/guide/files) - Voice/photo download patterns
- [grammY Files Plugin](https://grammy.dev/plugins/files) - Plugin installation and API
- [Claude Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision) - Image formats, limits, API
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) - CLI flags and usage

### Secondary (MEDIUM confidence)

- [OpenAI Whisper API FAQ](https://help.openai.com/en/articles/7031512-audio-api-faq) - Supported formats, limits
- [OpenAI Audio API Reference](https://platform.openai.com/docs/api-reference/audio/) - API details
- [ClaudeLog - Image Types](https://claudelog.com/faqs/claude-code-supported-image-upload-types/) - Claude Code image support

### Tertiary (LOW confidence)

- WebSearch results for Telegram OGG Opus format handling - verified against grammY docs
- WebSearch results for Claude Code image reading - verified against official docs

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Using existing packages, well-documented APIs
- Architecture: HIGH - Patterns match existing codebase structure
- Pitfalls: MEDIUM - Some based on general experience, not all tested

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (60 days - stable APIs)
