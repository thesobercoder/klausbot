import { createAnthropic } from "@ai-sdk/anthropic";
import { wrapAISDKModel } from "evalite";

const anthropic = createAnthropic();

/** Model under test — matches klausbot's production model class */
export const taskModel = wrapAISDKModel(
  anthropic("claude-sonnet-4-5-20250929"),
);

/** Judge model for LLM-as-judge scoring */
export const judgeModel = wrapAISDKModel(
  anthropic("claude-sonnet-4-5-20250929"),
);
