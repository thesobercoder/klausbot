/**
 * Heartbeat eval suite
 *
 * Tests HEARTBEAT_OK suppression when nothing is actionable,
 * and substantive reporting when items need attention.
 */

import { generateText } from "ai";
import { evalite } from "evalite";

import {
  createBehaviorScorer,
  createHeartbeatOkScorer,
  createNotExactScorer,
} from "./helpers/scorers.js";
import { judgeModel, taskModel } from "./helpers/model.js";
import {
  buildEvalSystemPrompt,
  buildHeartbeatPrompt,
} from "./helpers/prompts.js";

evalite<string, string, string>("Heartbeat HEARTBEAT_OK Suppression", {
  data: () => [
    {
      input: `# Heartbeat Reminders

## Active Items

(No items yet)`,
      expected: "HEARTBEAT_OK",
    },
    {
      input: `# Heartbeat Reminders

## Active Items

- [x] Check weather forecast [expires: 2026-02-01]
- [x] Send weekly summary`,
      expected: "HEARTBEAT_OK",
    },
  ],

  task: async (input) => {
    const { text } = await generateText({
      model: taskModel,
      system: buildEvalSystemPrompt(),
      prompt: buildHeartbeatPrompt(input),
    });
    return text;
  },

  scorers: [createHeartbeatOkScorer(judgeModel)],
});

evalite<string, string, string>("Heartbeat Actionable Items", {
  data: () => [
    {
      input: `# Heartbeat Reminders

## Active Items

- [ ] Remind user about dentist appointment on Friday
- [x] Check weather forecast`,
      expected:
        "Produces a substantive notification about the pending dentist reminder, not HEARTBEAT_OK",
    },
  ],

  task: async (input) => {
    const { text } = await generateText({
      model: taskModel,
      system: buildEvalSystemPrompt(),
      prompt: buildHeartbeatPrompt(input),
    });
    return text;
  },

  scorers: [
    createNotExactScorer("HEARTBEAT_OK"),
    createBehaviorScorer(judgeModel),
  ],
});
