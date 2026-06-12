import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateLlmText } from "../llm/clients.ts";
import type { LlmRegistry } from "../llm/index.ts";
import { renderPrompt } from "../llm/render-prompt.ts";
import type { LlmStep } from "../workflows/index.ts";
import type { StepEnvelope } from "./run-step.ts";

/**
 * Baked-in summariser prompt when `summarize: { llm: { model } }` declares no
 * prompt. Inlines the run envelope via `{{KIRI_RUN_CONTEXT}}` because llm
 * steps cannot read files on disk.
 */
export const DEFAULT_LLM_SUMMARIZER_PROMPT = `You are writing a kiri workflow run summary for an activity feed. Lead with what happened — no preamble like 'the workflow ran', no padding. Markdown is supported and encouraged.

Match the shape of the output to the shape of the result:
- If the workflow produced a list of items, output a markdown bullet list. Each bullet is one concrete item the reader can skim.
- If the workflow produced a single piece of news, output a single sentence or short paragraph.
- Use bold, inline code, and links where they help the reader scan.

The feed is glanced at, not read. Keep it dense and skimmable, with no headings.

The full run envelope is inlined below as JSON:

{{KIRI_RUN_CONTEXT}}

Skim what the workflow actually produced and write the summary from that.`;

export interface RunLlmStepArgs {
  step: LlmStep;
  cwd: string;
  /** Previous step stdout piped as KIRI_INPUT (one trailing newline trimmed). */
  input: string;
  env: Record<string, string>;
  llmRegistry: LlmRegistry;
  /** When true, an omitted prompt uses the default summariser template. */
  isSummarize?: boolean;
  /** Serialised run context for publish/summarize `{{KIRI_RUN_CONTEXT}}`. */
  runContextJson?: string;
  onAbortController?: (controller: AbortController) => void;
  generateText?: typeof generateLlmText;
}

/**
 * Execute a first-party `llm:` workflow step and return the standard envelope.
 * Completion text maps to `output` and `traces.stdout`; token usage lands on
 * `traces.usage` when the provider returns it.
 */
export async function runLlmStep(args: RunLlmStepArgs): Promise<StepEnvelope> {
  const startedAt = performance.now();
  const generate = args.generateText ?? generateLlmText;

  let promptSource = args.step.llm.prompt;
  if (args.step.llm.prompt_file) {
    promptSource = readFileSync(resolve(args.cwd, args.step.llm.prompt_file), "utf8");
  } else if (!promptSource && args.isSummarize) {
    promptSource = DEFAULT_LLM_SUMMARIZER_PROMPT;
  }

  if (!promptSource) {
    return {
      status: "failed",
      output: "",
      error: { message: "llm step requires prompt or prompt_file" },
      traces: { stdout: "", stderr: "", durationMs: performance.now() - startedAt },
    };
  }

  const vars: Record<string, string | undefined> = {
    ...args.env,
    KIRI_INPUT: args.input.replace(/\n$/, ""),
  };
  if (args.runContextJson !== undefined) {
    vars.KIRI_RUN_CONTEXT = args.runContextJson;
  }

  const prompt = renderPrompt(promptSource, vars);
  const controller = new AbortController();
  args.onAbortController?.(controller);

  try {
    const { text, usage } = await generate(args.llmRegistry, {
      model: args.step.llm.model,
      prompt,
      abortSignal: controller.signal,
    });
    const durationMs = performance.now() - startedAt;
    return {
      status: "ok",
      output: text,
      traces: { stdout: text, stderr: "", durationMs, usage },
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return {
      status: "failed",
      output: "",
      error: {
        message,
        stack: cause instanceof Error ? cause.stack : undefined,
      },
      traces: { stdout: "", stderr: "", durationMs: performance.now() - startedAt },
    };
  }
}
