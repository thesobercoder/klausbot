/**
 * Cron execution eval suite
 *
 * Tests that cron job outputs are substantive (real content)
 * rather than mere acknowledgments like "ok" or "I'll do that".
 */

import { generateText } from "ai";
import { evalite } from "evalite";

import {
  createBehaviorScorer,
  createSubstantivenessScorer,
} from "./helpers/scorers.js";
import { judgeModel, taskModel } from "./helpers/model.js";
import { buildEvalSystemPrompt, buildCronPrompt } from "./helpers/prompts.js";

evalite<string, string, string>("Cron Output Quality", {
  data: () => [
    {
      input:
        "Daily Motivation|Write a short motivational message to start the day",
      expected:
        "A substantive motivational message — uplifting, specific, not generic platitudes",
    },
    {
      input:
        "Fun Fact|Share an interesting science fact the user probably doesn't know",
      expected:
        "A specific, accurate science fact with a brief explanation of why it's interesting",
    },
    {
      input:
        "Exercise Reminder|Suggest a quick 10-minute workout routine for someone at a desk",
      expected:
        "A specific workout routine with named exercises, not vague advice like 'stretch more'",
    },
  ],

  task: async (input) => {
    const [jobName, instruction] = input.split("|", 2);
    const { text } = await generateText({
      model: taskModel,
      system: buildEvalSystemPrompt(),
      prompt: buildCronPrompt(jobName, instruction),
    });
    return text;
  },

  scorers: [
    createSubstantivenessScorer(judgeModel),
    createBehaviorScorer(judgeModel),
  ],
});
