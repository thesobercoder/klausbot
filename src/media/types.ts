/**
 * Media types for multimodal processing
 */

/** Supported media types */
export type MediaType = "voice" | "photo";

/** Attachment with optional processing results */
export interface MediaAttachment {
  type: MediaType;
  fileId: string;
  localPath?: string;
  transcript?: string;
  mimeType?: string;
  processingTimeMs?: number;
}

/** Result from audio transcription */
export interface TranscriptionResult {
  text: string;
  durationMs: number;
}
