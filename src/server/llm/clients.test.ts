import { afterEach, describe, expect, it } from "bun:test";
import { generateLlmText, resolveModel } from "./clients.ts";
import { createLlmRegistry } from "./registry.ts";
import type { LlmProviderDefinition } from "./schema.ts";

const seedRegistry = (
  providers: Record<string, LlmProviderDefinition>,
): ReturnType<typeof createLlmRegistry> => {
  const registry = createLlmRegistry();
  registry.replace(new Map(Object.entries(providers)));
  return registry;
};

describe("resolveModel", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects ids that are not in provider:model form", () => {
    const registry = seedRegistry({});
    expect(() => resolveModel(registry, "no-colon")).toThrow(/provider:model/);
  });

  it("throws for an unknown provider prefix with configured names listed", () => {
    const registry = seedRegistry({
      anthropic: { name: "anthropic", type: "anthropic", apiKeyEnv: "ANTHROPIC_API_KEY" },
    });
    expect(() => resolveModel(registry, "missing:claude-haiku-4-5")).toThrow(
      /unknown LLM provider "missing"/,
    );
    expect(() => resolveModel(registry, "missing:claude-haiku-4-5")).toThrow(/anthropic/);
  });

  it("constructs models for anthropic, openai, and openai-compatible providers", () => {
    process.env.TEST_ANTHROPIC = "anthropic-secret";
    process.env.TEST_OPENAI = "openai-secret";
    const registry = seedRegistry({
      anthropic: { name: "anthropic", type: "anthropic", apiKeyEnv: "TEST_ANTHROPIC" },
      openai: { name: "openai", type: "openai", apiKeyEnv: "TEST_OPENAI" },
      local: {
        name: "local",
        type: "openai-compatible",
        baseUrl: "http://127.0.0.1:1234/v1",
      },
    });

    expect(resolveModel(registry, "anthropic:claude-haiku-4-5").modelId).toBe("claude-haiku-4-5");
    expect(resolveModel(registry, "openai:gpt-4o-mini").modelId).toBe("gpt-4o-mini");
    expect(resolveModel(registry, "local:llama").modelId).toBe("llama");
  });
});

describe("generateLlmText", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("completes via the AI SDK and propagates usage", async () => {
    process.env.TEST_KEY = "secret-value-not-in-errors";
    const registry = seedRegistry({
      anthropic: { name: "anthropic", type: "anthropic", apiKeyEnv: "TEST_KEY" },
    });
    const result = await generateLlmText(
      registry,
      { model: "anthropic:claude-haiku-4-5", prompt: "hi" },
      async (opts) => {
        expect(opts.model.modelId).toBe("claude-haiku-4-5");
        return {
          text: "Hello from the model",
          usage: {
            inputTokens: 12,
            outputTokens: 5,
            totalTokens: 17,
            cachedInputTokens: 3,
          },
          finishReason: "stop",
          warnings: [],
          response: {
            id: "test",
            timestamp: new Date(),
            modelId: "claude-haiku-4-5",
          },
          request: {},
          content: [{ type: "text", text: "Hello from the model" }],
          steps: [],
        };
      },
    );

    expect(result.text).toBe("Hello from the model");
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 5,
      cachedInputTokens: 3,
      totalTokens: 17,
    });
  });

  it("bubbles provider errors without leaking api key material", async () => {
    process.env.LEAK_TEST_KEY = "super-secret-api-key-12345";
    const registry = seedRegistry({
      openai: { name: "openai", type: "openai", apiKeyEnv: "LEAK_TEST_KEY" },
    });

    await expect(
      generateLlmText(registry, { model: "openai:gpt-4o-mini", prompt: "hi" }, async () => {
        throw new Error("rate limit exceeded");
      }),
    ).rejects.toThrow(/rate limit exceeded/);

    try {
      await generateLlmText(registry, { model: "openai:gpt-4o-mini", prompt: "hi" }, async () => {
        throw new Error("rate limit exceeded");
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      expect(message).not.toContain("super-secret-api-key-12345");
    }
  });

  it("forwards abortSignal to the AI SDK call", async () => {
    process.env.TEST_KEY = "x";
    const registry = seedRegistry({
      anthropic: { name: "anthropic", type: "anthropic", apiKeyEnv: "TEST_KEY" },
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      generateLlmText(
        registry,
        { model: "anthropic:claude-haiku-4-5", prompt: "hi", abortSignal: controller.signal },
        async (opts) => {
          if (opts.abortSignal?.aborted) {
            throw new Error("aborted");
          }
          return {
            text: "nope",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            finishReason: "stop",
            warnings: [],
            response: { id: "x", timestamp: new Date(), modelId: "m" },
            request: {},
            content: [],
            steps: [],
          };
        },
      ),
    ).rejects.toThrow(/aborted/);
  });
});
