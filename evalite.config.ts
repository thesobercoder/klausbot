import "dotenv/config";
import { defineConfig } from "evalite/config";

export default defineConfig({
  scoreThreshold: 80,
  maxConcurrency: 3,
  testTimeout: 120_000,
});
