/**
 * Tool-use eval suites.
 *
 * Tests correct tool selection, search-before-ignorance behavior,
 * and drill-down (search → get_conversation) patterns.
 */

import { generateText, stepCountIs } from "ai";
import { evalite } from "evalite";

import {
  createExpectedToolCalledScorer,
  createToolCalledScorer,
  type ToolUseOutput,
} from "./helpers/scorers.js";
import { taskModel } from "./helpers/model.js";
import { buildEvalSystemPrompt } from "./helpers/prompts.js";
import { FIXTURES } from "./helpers/fixtures.js";
import { createMockTools } from "./helpers/tools.js";

const mockTools = createMockTools(FIXTURES);

/**
 * Collect all tool calls from generateText steps.
 */
function collectToolCalls(
  steps: Array<{ toolCalls: Array<{ toolName: string; args: unknown }> }>,
): ToolUseOutput["toolCalls"] {
  return steps.flatMap((step) =>
    step.toolCalls.map((tc) => ({
      toolName: tc.toolName,
      args: tc.args as Record<string, unknown>,
    })),
  );
}

// ---------------------------------------------------------------------------
// Suite 1: Correct Tool Selection — 4 cases
// ---------------------------------------------------------------------------

evalite<string, ToolUseOutput, string>("Tool Selection", {
  data: () => [
    {
      input: "What did we talk about last month?",
      expected: "search_memories",
    },
    {
      input: "Remind me every morning at 9am to check emails",
      expected: "create_cron",
    },
    {
      input: "Research latest AI developments and write a summary",
      expected: "start_background_task",
    },
    {
      input: "Show me the full conversation from session eval-fixture-15d",
      expected: "get_conversation",
    },
  ],

  task: async (input) => {
    const result = await generateText({
      model: taskModel,
      system: buildEvalSystemPrompt(),
      prompt: input,
      tools: mockTools,
      stopWhen: [stepCountIs(3)],
    });
    return {
      text: result.text,
      toolCalls: collectToolCalls(result.steps),
    };
  },

  scorers: [createExpectedToolCalledScorer()],
});

// ---------------------------------------------------------------------------
// Suite 2: Search Before Admitting Ignorance — 3 cases
// ---------------------------------------------------------------------------

evalite<string, ToolUseOutput, string>("Search Before Ignorance", {
  data: () => [
    {
      input: "What was that recipe I asked you about?",
      expected: "Must call search_memories before answering",
    },
    {
      input: "Remember that thing I told you about my brother?",
      expected: "Must call search_memories before answering",
    },
    {
      input: "What did I say about my weekend plans?",
      expected: "Must call search_memories before answering",
    },
  ],

  task: async (input) => {
    const result = await generateText({
      model: taskModel,
      system: buildEvalSystemPrompt(),
      prompt: input,
      tools: mockTools,
      stopWhen: [stepCountIs(3)],
    });
    return {
      text: result.text,
      toolCalls: collectToolCalls(result.steps),
    };
  },

  scorers: [createToolCalledScorer("search_memories")],
});

// ---------------------------------------------------------------------------
// Suite 3: Drill-Down Pattern — 1 case
// search_memories THEN get_conversation
// ---------------------------------------------------------------------------

evalite<string, ToolUseOutput, string>("Drill-Down Pattern", {
  data: () => [
    {
      input:
        "What exactly did I say about travel plans? I need the exact words.",
      expected:
        "Must call search_memories to find the conversation, then get_conversation for full transcript",
    },
  ],

  task: async (input) => {
    const result = await generateText({
      model: taskModel,
      system: buildEvalSystemPrompt(),
      prompt: input,
      tools: mockTools,
      stopWhen: [stepCountIs(5)],
    });
    return {
      text: result.text,
      toolCalls: collectToolCalls(result.steps),
    };
  },

  scorers: [
    createToolCalledScorer("search_memories"),
    createToolCalledScorer("get_conversation"),
  ],
});
