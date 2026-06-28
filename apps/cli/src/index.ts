#!/usr/bin/env tsx
import readline from "node:readline";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";

import { chat, configureAgent } from "./agent.js";
import { isOnboarded, readConfig } from "./config.js";
import { bold, cyan, dim, green, hr } from "./fmt.js";
import { runOnboarding } from "./onboard.js";

const VERSION = "0.1.0";

function printBanner(): void {
  console.log(`\n${bold(cyan("Harness Dreams CLI"))} ${dim(`v${VERSION}`)}`);
  console.log(dim("  Type your message to chat with the agent."));
  console.log(dim("  Commands: /ingest, /dream, /suggest, /setup, /quit"));
  console.log(hr() + "\n");
}

const SHORTCUTS: Record<string, string> = {
  "/ingest": "Please discover all my projects and coding sessions.",
  "/dream": "Run a sleep cycle analysis on my projects.",
  "/suggest": "Show me the suggestions from the last dream report.",
  "/help": "What can you help me with?",
};

async function main(): Promise<void> {
  let config = readConfig();
  const firstRun = !isOnboarded(config);

  if (firstRun) {
    config = await runOnboarding(true);
  }

  // Inject credentials into the agent before the banner appears
  configureAgent(config.apiKey, config.model);

  printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${green("you")} > `,
  });

  let history: MessageParam[] = [];

  rl.prompt();

  rl.on("line", async (line) => {
    const raw = line.trim();
    if (!raw) {
      rl.prompt();
      return;
    }

    if (raw === "/quit" || raw === "/exit" || raw === "/q") {
      console.log(dim("\nGoodnight.\n"));
      rl.close();
      process.exit(0);
    }

    if (raw === "/setup") {
      rl.pause();
      try {
        config = await runOnboarding(false);
        configureAgent(config.apiKey, config.model);
        // Reset history so the new model starts fresh
        history = [];
      } finally {
        rl.resume();
        rl.prompt();
      }
      return;
    }

    const message = SHORTCUTS[raw] ?? raw;

    try {
      rl.pause();
      history = await chat(history, message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n${bold("Error")}: ${msg}\n`);
    } finally {
      console.log("");
      rl.resume();
      rl.prompt();
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
