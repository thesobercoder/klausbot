/**
 * Heartbeat module - periodic awareness system
 */

export { startHeartbeat, stopHeartbeat } from "./scheduler.js";
export { executeHeartbeat, getHeartbeatPath, type HeartbeatResult } from "./executor.js";
export { shouldCollectNote, getNoteCollectionInstructions } from "./notes.js";
