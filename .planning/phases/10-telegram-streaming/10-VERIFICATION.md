---
phase: 10-telegram-streaming
verified: 2026-02-05T11:32:03Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Enable forum topics and send message"
    expected: "Draft bubble appears and updates every 500ms, final message replaces draft"
    why_human: "Draft streaming requires BotFather config and visual verification of real-time updates"
  - test: "Disable streaming via config"
    expected: "Bot falls back to batch mode (typing indicator, then message)"
    why_human: "Config-based fallback needs end-to-end testing"
  - test: "Send message during streaming timeout"
    expected: "Partial result returned after 5 minutes"
    why_human: "Timeout behavior requires long-running test"
---

# Phase 10: Telegram Streaming Verification Report

**Phase Goal:** Users see real-time response generation in Telegram
**Verified:** 2026-02-05T11:32:03Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                         | Status     | Evidence                                                                                                  |
| --- | ------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 1   | User sees draft message updating as Claude generates response | ✓ VERIFIED | streamToTelegram calls sendMessageDraft with throttled updates (streaming.ts:239)                         |
| 2   | Draft updates are throttled to avoid Telegram API rate limits | ✓ VERIFIED | Throttling logic at streaming.ts:237 checks `now - lastUpdateTime >= config.throttleMs`                   |
| 3   | Final message replaces draft when streaming completes         | ✓ VERIFIED | splitAndSend called after streaming (gateway.ts:633), sends final message via bot.api.sendMessage         |
| 4   | Streaming can be disabled via config                          | ✓ VERIFIED | Gateway checks `jsonConfig.streaming?.enabled` (gateway.ts:600-601), falls back to batch (gateway.ts:677) |

**Score:** 4/4 truths verified

### Required Artifacts

#### Plan 10-01 Artifacts

| Artifact                    | Expected                                         | Status     | Details                                                                           |
| --------------------------- | ------------------------------------------------ | ---------- | --------------------------------------------------------------------------------- |
| `src/telegram/streaming.ts` | Claude stream spawner + draft streaming logic    | ✓ VERIFIED | 281 lines, exports streamClaudeResponse, streamToTelegram, canStreamToChat, types |
| `src/config/schema.ts`      | Extended jsonConfigSchema with streaming options | ✓ VERIFIED | Lines 54-61 define streaming object with enabled and throttleMs                   |
| `src/telegram/bot.ts`       | Bot with throttler transformer                   | ✓ VERIFIED | Lines 31-38 configure apiThrottler after autoRetry                                |
| `package.json`              | @grammyjs/transformer-throttler dependency       | ✓ VERIFIED | Installed v1.2.1 (verified via npm ls)                                            |

#### Plan 10-02 Artifacts

| Artifact                    | Expected                                       | Status     | Details                                                     |
| --------------------------- | ---------------------------------------------- | ---------- | ----------------------------------------------------------- |
| `src/telegram/streaming.ts` | streamToTelegram and canStreamToChat functions | ✓ VERIFIED | Lines 185-196 (canStreamToChat), 219-280 (streamToTelegram) |
| `src/daemon/gateway.ts`     | Gateway with streaming/batch path selection    | ✓ VERIFIED | Lines 600-676 implement streaming path with fallback        |
| `src/telegram/index.ts`     | Exports streaming functions                    | ✓ VERIFIED | Lines 10-17 export streaming functions and types            |

### Key Link Verification

#### Link 1: src/telegram/streaming.ts → child_process.spawn

**Pattern:** spawn.*claude.*stream-json

**Status:** ✓ WIRED

**Evidence:**

- Line 84: `spawn("claude", args, ...)` with stdio configuration
- Lines 67-76: args include `"--output-format", "stream-json"`
- Lines 116-144: NDJSON parsing with readline interface
- Lines 118-144: Event parsing extracts deltas and calls onChunk callback

#### Link 2: src/telegram/bot.ts → @grammyjs/transformer-throttler

**Pattern:** apiThrottler

**Status:** ✓ WIRED

**Evidence:**

- Line 4: `import { apiThrottler } from "@grammyjs/transformer-throttler"`
- Lines 31-38: `bot.api.config.use(apiThrottler({...}))`
- Configuration: maxConcurrent: 1, minTime: 100ms
- Placed after autoRetry for correct retry behavior

#### Link 3: src/daemon/gateway.ts → src/telegram/streaming.ts

**Pattern:** streamToTelegram.\*chatId

**Status:** ✓ WIRED

**Evidence:**

- Lines 3-6: Import streamToTelegram, canStreamToChat
- Lines 600-602: Check streaming enabled and chat capability
- Lines 604-623: Call streamToTelegram with bot, chatId, config
- Lines 632-636: Send final message via splitAndSend
- Lines 668-673: Catch streaming errors and fall back to batch

#### Link 4: src/telegram/streaming.ts → bot.api.sendMessageDraft

**Pattern:** sendMessageDraft.\*draftId

**Status:** ✓ WIRED

**Evidence:**

- Lines 233-247: onChunk callback with throttle logic
- Line 239: `bot.api.sendMessageDraft(chatId, draftId, accumulated, {...})`
- Line 237: Throttling check `now - lastUpdateTime >= config.throttleMs`
- Line 199: draftIdCounter for unique draft IDs

#### Link 5: src/telegram/streaming.ts → bot.api.sendMessage

**Pattern:** sendMessage.\*result

**Status:** ✓ WIRED (via gateway)

**Evidence:**

- Gateway handles final message sending (not streaming module)
- Line 633: `splitAndSend(msg.chatId, streamResult.result)`
- Line 784: splitAndSend calls `bot.api.sendMessage(chatId, chunk)`
- Streaming module returns result, gateway sends final message

### Requirements Coverage

No requirements explicitly mapped to Phase 10 in REQUIREMENTS.md, but ROADMAP.md lists:

- STRM-01: Draft streaming via sendMessageDraft — ✓ SATISFIED
- STRM-02: Throttled updates (configurable) — ✓ SATISFIED
- STRM-03: Final message after streaming — ✓ SATISFIED
- STRM-04: Streaming configurable — ✓ SATISFIED

### Anti-Patterns Found

**None detected.**

Scan results:

- No TODO/FIXME comments in streaming.ts or gateway.ts streaming path
- No placeholder content
- No stub patterns (empty returns, console.log-only implementations)
- Build passes: `npm run build` succeeds
- All functions have substantive implementations with error handling
- Timeout handling present (5 minute default matching batch spawner)

### Human Verification Required

#### 1. Draft Streaming Visual Experience

**Test:**

1. Open @BotFather in Telegram
2. Run: /mybots → Select bot → Bot Settings → Topics in Private Chats → Turn On
3. Send a message to bot in private chat
4. Observe draft bubble behavior

**Expected:**

- Draft bubble appears within 1-2 seconds
- Draft updates approximately every 500ms with new text
- Draft shows progressive response generation
- Final message replaces draft when complete
- No duplicate messages (draft properly replaced)

**Why human:** Draft streaming is a visual/UX feature requiring real Telegram client observation. Cannot verify draft appearance/updates/replacement programmatically.

#### 2. Streaming Configuration Toggle

**Test:**

1. Edit ~/.klausbot/config/klausbot.json
2. Set `"streaming": { "enabled": false }`
3. Restart klausbot
4. Send message to bot

**Expected:**

- Typing indicator appears (not draft)
- Wait for full response generation
- Message appears all at once (batch mode)
- No draft bubble shown

**Why human:** Config-based fallback requires end-to-end testing with config file modification and process restart.

#### 3. Throttle Configuration Effect

**Test:**

1. Set `"streaming": { "enabled": true, "throttleMs": 2000 }`
2. Restart klausbot
3. Send message requiring long response
4. Observe draft update frequency

**Expected:**

- Draft updates approximately every 2 seconds (not 500ms)
- Fewer draft updates total
- Final message still correct and complete

**Why human:** Throttle timing requires human observation of update frequency over time.

#### 4. Timeout and Partial Results

**Test:**

1. Send very complex prompt likely to exceed 5 minute timeout
2. Wait for timeout

**Expected:**

- After 5 minutes, process terminates
- Partial accumulated result sent as final message
- cost_usd = 0 for timed out response
- No error message (graceful degradation)

**Why human:** Timeout testing requires long-running session and observation of partial result handling.

#### 5. Streaming Unavailable Fallback

**Test:**

1. Send message from group chat (not private chat)
2. OR send message without forum topics enabled

**Expected:**

- Log shows "Using batch mode" or streaming disabled
- Typing indicator appears
- Response sent as regular message (not draft)
- No errors about streaming

**Why human:** Chat type detection and fallback requires testing in different chat contexts (private vs group).

### Gaps Summary

**No gaps found.** All automated verification passed:

**Streaming Infrastructure (Plan 01):**

- ✓ Config schema extended with streaming options (enabled, throttleMs)
- ✓ Throttler transformer configured on bot
- ✓ streamClaudeResponse spawns Claude with stream-json output
- ✓ NDJSON parsing extracts text deltas and cost_usd
- ✓ Callback pattern implemented (onChunk called for each delta)

**Gateway Integration (Plan 02):**

- ✓ canStreamToChat checks private chat + topics capability
- ✓ streamToTelegram sends throttled draft updates
- ✓ Gateway checks streaming config and chat capability
- ✓ Streaming path integrated before batch fallback
- ✓ Final message sent via splitAndSend after streaming
- ✓ Error handling with fallback to batch on streaming failure
- ✓ Timeout handling (5 minutes, partial results on timeout)

**Phase Goal Achievement:**
All success criteria from ROADMAP.md are structurally verified in code. Human testing required to confirm end-user experience matches implementation.

### Additional Feature: Markdown to HTML Conversion

**Added post-verification:** Markdown responses are now converted to Telegram HTML format for proper rendering.

| Feature                     | Status     | Evidence                                                     |
| --------------------------- | ---------- | ------------------------------------------------------------ |
| Markdown → HTML converter   | ✓ VERIFIED | src/utils/telegram-html.ts (markdownToTelegramHtml function) |
| Code blocks converted       | ✓ VERIFIED | `<pre><code class="language-X">` output                      |
| Inline code, bold, italic   | ✓ VERIFIED | Conversion for backticks, \*_, _ patterns                    |
| Links, headers, blockquotes | ✓ VERIFIED | Full markdown pattern support                                |
| parse_mode: "HTML" used     | ✓ VERIFIED | gateway.ts:793 uses parse_mode in sendMessage                |
| Fallback on parse error     | ✓ VERIFIED | gateway.ts:796 catches and sends plain text                  |

**Human verification needed:** Confirm code blocks, bold, italic render properly in Telegram client.

---

_Verified: 2026-02-05T11:32:03Z_
_Verifier: Claude (gsd-verifier)_
_Updated: 2026-02-05 — Added markdown formatting verification_
