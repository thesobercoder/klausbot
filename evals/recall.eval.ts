/**
 * Recall eval suites — passive and active.
 *
 * Passive (1d, 7d): conversation context injected in system prompt.
 * Active (15d–90d): no context injection, mock MCP tools provided.
 */

import { generateText, stepCountIs } from "ai";
import { evalite } from "evalite";

import {
  createBehaviorScorer,
  createRecallAccuracyScorer,
} from "./helpers/scorers.js";
import { judgeModel, taskModel } from "./helpers/model.js";
import {
  buildEvalSystemPrompt,
  buildEvalSystemPromptWithContext,
} from "./helpers/prompts.js";
import {
  getPassiveFixtures,
  getActiveFixtures,
  buildContextWithFixtures,
  FIXTURES,
} from "./helpers/fixtures.js";
import { createMockTools } from "./helpers/tools.js";

// ---------------------------------------------------------------------------
// Suite 1: Passive Recall (1d, 7d) — facts in context, no tools needed
// ---------------------------------------------------------------------------

const passiveFixtures = getPassiveFixtures();

evalite<string, string, string>("Passive Recall", {
  data: () =>
    passiveFixtures.flatMap((fixture) =>
      fixture.facts.map((fact) => ({
        input: fact.question,
        expected: fact.fact,
      })),
    ),

  task: async (input) => {
    const context = buildContextWithFixtures(passiveFixtures);
    const { text } = await generateText({
      model: taskModel,
      system: buildEvalSystemPromptWithContext(context),
      prompt: input,
    });
    return text;
  },

  scorers: [
    createRecallAccuracyScorer(judgeModel),
    createBehaviorScorer(judgeModel),
  ],
});

// ---------------------------------------------------------------------------
// Suite 2: Active Recall (15d–90d) — must use tools to find facts
// ---------------------------------------------------------------------------

const activeFixtures = getActiveFixtures();
const mockTools = createMockTools(FIXTURES);

evalite<string, string, string>("Active Recall", {
  data: () =>
    activeFixtures.flatMap((fixture) =>
      fixture.facts.map((fact) => ({
        input: fact.question,
        expected: fact.fact,
      })),
    ),

  task: async (input) => {
    const { text } = await generateText({
      model: taskModel,
      system: buildEvalSystemPrompt(),
      prompt: input,
      tools: mockTools,
      stopWhen: [stepCountIs(3)],
    });
    return text;
  },

  scorers: [
    createRecallAccuracyScorer(judgeModel),
    createBehaviorScorer(judgeModel),
  ],
});
