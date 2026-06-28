import readline from "node:readline";

import Anthropic from "@anthropic-ai/sdk";

import { MODELS, type CliConfig, type ModelId, readConfig, writeConfig } from "./config.js";
import { bold, cyan, dim, green, hr, red, yellow } from "./fmt.js";

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function promptApiKey(rl: readline.Interface): Promise<string> {
  console.log(`\n${bold("Step 1 of 2 — Anthropic API key")}`);
  console.log(dim("  Get your key at: https://console.anthropic.com/settings/keys"));
  console.log(
    dim("  The key is stored in ~/.harness-dreams/cli-config.json (never sent elsewhere).\n")
  );

  for (;;) {
    const raw = (await ask(rl, `  ${cyan("API key")} > `)).trim();
    if (!raw) {
      console.log(red("  Key cannot be empty. Try again."));
      continue;
    }
    if (!raw.startsWith("sk-ant-")) {
      const ok = (await ask(rl, yellow("  Key doesn't look like an Anthropic key (sk-ant-…). Use it anyway? [y/N] "))).trim();
      if (ok.toLowerCase() !== "y") continue;
    }
    // Quick validation call
    process.stdout.write(dim("  Verifying key… "));
    try {
      const client = new Anthropic({ apiKey: raw });
      await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      console.log(green("✓ Valid"));
      return raw;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(red(`✗ Failed`));
      console.log(red(`  ${msg}`));
      const retry = (await ask(rl, "  Try a different key? [Y/n] ")).trim();
      if (retry.toLowerCase() === "n") return raw;
    }
  }
}

async function promptModel(rl: readline.Interface, current: ModelId): Promise<ModelId> {
  console.log(`\n${bold("Step 2 of 2 — Choose a model")}\n`);
  for (const [i, m] of MODELS.entries()) {
    const marker = m.id === current ? green("→") : " ";
    console.log(`  ${marker} ${yellow(`[${i + 1}]`)} ${m.label}`);
  }
  console.log("");

  for (;;) {
    const raw = (await ask(rl, `  ${cyan("Model")} [1-${MODELS.length}] (Enter = keep current) > `)).trim();
    if (!raw) return current;
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= MODELS.length) {
      return MODELS[n - 1]!.id;
    }
    console.log(red(`  Enter a number between 1 and ${MODELS.length}.`));
  }
}

/** Run the first-time setup wizard. Returns the updated config. */
export async function runOnboarding(isFirstRun: boolean): Promise<CliConfig> {
  const config = readConfig();

  console.log("\n" + hr("═"));
  if (isFirstRun) {
    console.log(bold(cyan("  Welcome to Harness Dreams CLI")));
    console.log(dim("  Let's get you set up. This only takes a moment.\n"));
  } else {
    console.log(bold(cyan("  Harness Dreams CLI — Settings")));
    console.log(dim("  Update your API key and model.\n"));
  }
  console.log(hr("═"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const apiKey = await promptApiKey(rl);
    const model = await promptModel(rl, config.model);

    const next: CliConfig = { ...config, apiKey, model };
    writeConfig(next);

    console.log("\n" + hr());
    console.log(green(`  ✓ All set! Using ${bold(model)}.`));
    console.log(dim(`  Config saved to ~/.harness-dreams/cli-config.json`));
    console.log(hr() + "\n");

    return next;
  } finally {
    rl.close();
  }
}
