/**
 * Whisper API transcription for audio files
 */

import OpenAI from "openai";
import { createReadStream } from "fs";
import { createChildLogger } from "../utils/index.js";
import type { TranscriptionResult } from "./types.js";

const log = createChildLogger("media:transcribe");

/**
 * Check if transcription is available (OPENAI_API_KEY set)
 */
export function isTranscriptionAvailable(): boolean {
  const available = Boolean(process.env.OPENAI_API_KEY);
  if (!available) {
    log.warn("OPENAI_API_KEY not set, transcription unavailable");
  }
  return available;
}

/**
 * Transcribe audio file using Whisper API
 * @param audioPath - Path to audio file (ogg, mp3, wav, etc.)
 * @returns Transcription text and duration
 * @throws Error if API key missing, rate limited, timeout, or other failure
 */
export async function transcribeAudio(
  audioPath: string,
): Promise<TranscriptionResult> {
  if (!isTranscriptionAvailable()) {
    throw new Error("Transcription unavailable: OPENAI_API_KEY not set");
  }

  const openai = new OpenAI();
  const startTime = Date.now();

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: "whisper-1",
    });

    const durationMs = Date.now() - startTime;
    log.info(
      { audioPath, textLength: transcription.text.length, durationMs },
      "transcription complete",
    );

    return {
      text: transcription.text,
      durationMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
      throw new Error(`Rate limited: ${message}`);
    }

    if (lowerMessage.includes("timeout") || lowerMessage.includes("503")) {
      throw new Error(`Timeout: ${message}`);
    }

    throw new Error(`Transcription failed: ${message}`);
  }
}
