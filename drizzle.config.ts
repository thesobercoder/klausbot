import { defineConfig } from "drizzle-kit";
import { homedir } from "os";
import { join } from "path";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/memory/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: "file:" + join(homedir(), ".klausbot", "klausbot.db"),
  },
});
