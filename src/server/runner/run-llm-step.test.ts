import { describe, expect, it } from "bun:test";
import type { GenerateLlmTextResult } from "../llm/clients.ts";
import { createLlmRegistry } from "../llm/index.ts";
import { DEFAULT_LLM_SUMMARIZER_PROMPT, runLlmStep } from "./run-llm-step.ts";

describe("runLlmStep", () => {
  it("pipes completion text through the standard envelope with usage", async () => {
    const registry = createLlmRegistry();
    registry.replace(
      new Map([["anthropic", { name: "anthropic", type: "anthropic", apiKeyEnv: "K" }]]),
    );

    const envelope = await runLlmStep({
      step: { llm: { model: "anthropic:claude-haiku-4-5", prompt: "Say {{KIRI_INPUT}}" } },
      cwd: "/tmp",
      input: "hello\n",
      env: { KIRI_RUN_ID: "r1", KIRI_STEP_INDEX: "0", KIRI_REPO_ROOT: "/repo" },
      llmRegistry: registry,
      generateText: async () =>
        ({
          text: "done",
          usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        }) satisfies GenerateLlmTextResult,
    });

    expect(envelope.status).toBe("ok");
    expect(envelope.output).toBe("done");
    expect(envelope.traces.usage).toEqual({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
  });

  it("uses the default summariser prompt when summarize omits a prompt source", async () => {
    const registry = createLlmRegistry();
    registry.replace(
      new Map([["anthropic", { name: "anthropic", type: "anthropic", apiKeyEnv: "K" }]]),
    );
    let seenPrompt = "";
    await runLlmStep({
      step: { llm: { model: "anthropic:claude-haiku-4-5" } },
      cwd: "/tmp",
      input: "",
      env: {},
      llmRegistry: registry,
      isSummarize: true,
      runContextJson: '{"workflow":"wf"}',
      generateText: async (_registry, params) => {
        seenPrompt = params.prompt;
        return { text: "summary", usage: {} };
      },
    });
    expect(seenPrompt).toContain(DEFAULT_LLM_SUMMARIZER_PROMPT.slice(0, 40));
    expect(seenPrompt).toContain('{"workflow":"wf"}');
  });

  it("maps provider failures to a failed envelope", async () => {
    const registry = createLlmRegistry();
    registry.replace(
      new Map([["openai", { name: "openai", type: "openai", apiKeyEnv: "K" }]]),
    );
    const envelope = await runLlmStep({
      step: { llm: { model: "openai:gpt-4o-mini", prompt: "hi" } },
      cwd: "/tmp",
      input: "",
      env: {},
      llmRegistry: registry,
      generateText: async () => {
        throw new Error("rate limited");
      },
    });
    expect(envelope.status).toBe("failed");
    expect(envelope.error?.message).toBe("rate limited");
  });
});
