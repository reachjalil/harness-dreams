import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages.js";

import type { ModelId } from "./config.js";

import {
  applyPatch,
  discoverProjects,
  getSuggestions,
  printApplyResult,
  printDiscoverResult,
  printDreamResult,
  printSuggestions,
  runDream,
} from "./tools.js";
import { bold, cyan, dim, red } from "./fmt.js";

let client = new Anthropic();
let activeModel: ModelId = "claude-opus-4-8";

/** Call once after onboarding to inject the user's credentials. */
export function configureAgent(apiKey: string, model: ModelId): void {
  client = new Anthropic({ apiKey: apiKey || undefined });
  activeModel = model;
}

const TOOLS: Tool[] = [
  {
    name: "discover_projects",
    description:
      "Scan the local machine for Claude Code and Codex coding sessions. Returns all discovered projects and saves them to config so run_dream can analyze them.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "run_dream",
    description:
      "Run a Sleep Cycle analysis over all enabled projects. Ingests recent coding sessions, computes efficiency/effectiveness/alignment rings, and generates improvement findings. Must be run before get_suggestions or apply_patch.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_suggestions",
    description:
      "Return the list of actionable improvement suggestions from the last dream report. Each suggestion has an index that can be passed to apply_patch.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "apply_patch",
    description:
      "Show a preview of the patch for a suggestion and prompt the user to confirm before writing it to disk. Pass the suggestion's index from get_suggestions.",
    input_schema: {
      type: "object",
      properties: {
        finding_index: {
          type: "number",
          description: "Index of the suggestion from get_suggestions to apply.",
        },
      },
      required: ["finding_index"],
    },
  },
];

const SYSTEM = `You are Harness Dreams CLI, an AI assistant embedded in a developer workflow tool.
You help users discover their coding sessions, run sleep cycle analysis to measure collaboration efficiency,
and apply concrete improvements to their AGENTS.md, CLAUDE.md, and skill files.

Tools available:
- discover_projects: find all local coding sessions
- run_dream: analyze sessions and produce findings
- get_suggestions: list actionable patches from the last report
- apply_patch: apply a specific patch with user confirmation

Be concise and action-oriented. When the user asks to run, start, or analyze, use the appropriate tool.
Always call get_suggestions after run_dream if the user wants to see recommendations.`;

type ToolInput = Record<string, unknown>;

async function callTool(name: string, input: ToolInput): Promise<string> {
  try {
    if (name === "discover_projects") {
      const result = discoverProjects();
      printDiscoverResult(result);
      return JSON.stringify(result);
    }
    if (name === "run_dream") {
      const result = runDream();
      printDreamResult(result);
      return JSON.stringify(result);
    }
    if (name === "get_suggestions") {
      const result = getSuggestions();
      printSuggestions(result);
      return JSON.stringify(result);
    }
    if (name === "apply_patch") {
      const index = Number(input["finding_index"] ?? 0);
      const result = await applyPatch(index);
      printApplyResult(result);
      return JSON.stringify(result);
    }
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(red(`  Tool error (${name}): ${message}`));
    return JSON.stringify({ error: message });
  }
}

export async function chat(
  history: MessageParam[],
  userMessage: string
): Promise<MessageParam[]> {
  const messages: MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  // Agentic loop
  for (;;) {
    const response = await client.messages.create({
      model: activeModel,
      max_tokens: 4096,
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });

    // Collect text output
    const textBlocks = response.content.filter((b) => b.type === "text");
    if (textBlocks.length > 0) {
      const text = textBlocks.map((b) => ("text" in b ? b.text : "")).join("");
      if (text.trim()) {
        console.log(`\n${cyan(bold("hd"))} ${text}`);
      }
    }

    // Push assistant turn into history
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") break;

    // Execute all tool calls
    const toolUses = response.content.filter((b) => b.type === "tool_use");
    const toolResults: MessageParam["content"] = [];

    for (const block of toolUses) {
      if (block.type !== "tool_use") continue;
      console.log(dim(`  → ${block.name}...`));
      const result = await callTool(block.name, block.input as ToolInput);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return messages;
}
