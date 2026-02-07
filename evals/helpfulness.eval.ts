/**
 * Helpfulness eval suites.
 *
 * Tests response quality (depth, empathy, actionability)
 * and completeness (structured, thorough answers).
 */

import { generateText } from "ai";
import { evalite } from "evalite";

import { createQualityScorer } from "./helpers/scorers.js";
import { judgeModel, taskModel } from "./helpers/model.js";
import { buildEvalSystemPrompt } from "./helpers/prompts.js";

// ---------------------------------------------------------------------------
// Suite 1: Response Quality — 5 cases
// ---------------------------------------------------------------------------

evalite<string, string, string>("Response Quality", {
  data: () => [
    {
      input: "Can you explain closures in JavaScript?",
      expected:
        "Clear, accurate explanation of JS closures with an example. Conversational tone, not a textbook.",
    },
    {
      input: "I've been really stressed about work lately",
      expected:
        "Empathetic, warm response. Acknowledges feelings first. May gently offer support or perspective but should not lead with a solution checklist.",
    },
    {
      input:
        "I have chicken, rice, and some vegetables. What can I make for dinner?",
      expected:
        "Suggests a specific recipe with brief steps. Practical and actionable, not a generic list.",
    },
    {
      input:
        "Can you help me draft a message to my landlord about a broken heater?",
      expected:
        "Drafts a polite, clear message requesting heater repair. Ready to send or nearly so.",
    },
    {
      input: "I keep forgetting to wake up on time",
      expected:
        "Offers practical advice. May suggest setting up a recurring reminder (since Klaus can do crons). Proactive and helpful.",
    },
  ],

  task: async (input) => {
    const { text } = await generateText({
      model: taskModel,
      temperature: 0,
      system: buildEvalSystemPrompt(),
      prompt: input,
    });
    return text;
  },

  scorers: [createQualityScorer(judgeModel)],
});

// ---------------------------------------------------------------------------
// Suite 2: Completeness — 3 cases
// ---------------------------------------------------------------------------

evalite<string, string, string>("Response Completeness", {
  data: () => [
    {
      input: "Compare PostgreSQL and MySQL for me",
      expected:
        "Covers key differences: performance, features, use cases, licensing. Structured comparison, not one-sided.",
    },
    {
      input: "Write me a haiku about rain",
      expected:
        "A short poem about rain in haiku style (3 lines, roughly 5-7-5 syllables). Creative and evocative.",
    },
    {
      input: "Give me 3 tips for visiting Tokyo",
      expected:
        "Exactly 3 practical, specific tips. Not generic travel advice — Tokyo-specific insights.",
    },
  ],

  task: async (input) => {
    const { text } = await generateText({
      model: taskModel,
      temperature: 0,
      system: buildEvalSystemPrompt(),
      prompt: input,
    });
    return text;
  },

  scorers: [createQualityScorer(judgeModel)],
});
