# Phase 6: Multimodal - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Process voice messages and images as naturally as text. User sends voice → transcribed and responded to. User sends image → analyzed and acted upon. Processing errors surfaced clearly. Voice/image are input-only — responses always text.

</domain>

<decisions>
## Implementation Decisions

### Voice handling
- Transcription via OpenAI Whisper API (hosted, pay-per-use)
- Respond directly — no explicit transcript shown to user
- Best effort transcription with warning if quality issues detected
- Delete audio files after transcription — transcript saved to conversation log
- If OPENAI_API_KEY missing at launch: log capability as unavailable, respond with "audio transcription not available" when voice received
- Log available/unavailable capabilities at gateway startup

### Image analysis
- Images passed directly to Claude with the message — Claude decides action based on context
- Keep image files after processing — store in `~/.klausbot/images/{date}/`
- Multiple images in one message supported — batch all to Claude together
- Conversation log stores absolute path to image file (not embedded data)

### Error feedback
- Technical + actionable error messages ("Transcription failed (codec unsupported). Try sending as mp3.")
- Retry transient failures (timeout, rate limit) with exponential backoff — up to 3 retries
- Trust Whisper API to handle most formats — only surface errors if API actually fails
- If media capability disabled: inform user and skip media, process any text in message ("Can't process voice/image (not configured). Responding to text only.")

### Response style
- No immediate acknowledgment — wait until processing complete, send one response
- Voice is input-only — all responses are text
- Text + media: media provides context for the text question
- Log full details: media type, file path, transcript/description, processing time

### Claude's Discretion
- Exact retry timing and backoff intervals
- Image filename convention
- How to surface confidence warnings for poor audio

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-multimodal*
*Context gathered: 2026-01-30*
