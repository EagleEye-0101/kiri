import { afterEach, describe, expect, it } from "bun:test";
import { llmProvidersSchema } from "./schema.ts";

describe("llmProvidersSchema", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("accepts a valid anthropic provider with explicit api_key env ref", () => {
    process.env.MY_ANTHROPIC_KEY = "secret";
    const result = llmProvidersSchema.safeParse({
      providers: {
        anthropic: {
          api_key: { env: "MY_ANTHROPIC_KEY" },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts openai-compatible with base_url and no api_key", () => {
    const result = llmProvidersSchema.safeParse({
      providers: {
        local: {
          type: "openai-compatible",
          base_url: "http://127.0.0.1:1234/v1",
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a literal api_key string", () => {
    const result = llmProvidersSchema.safeParse({
      providers: {
        anthropic: {
          api_key: "sk-secret",
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a declared env ref when the variable is not set", () => {
    const result = llmProvidersSchema.safeParse({
      providers: {
        anthropic: {
          api_key: { env: "KIRI_TEST_UNSET_LLM_PROVIDER_KEY" },
        },
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("KIRI_TEST_UNSET_LLM_PROVIDER_KEY");
    }
  });

  it("rejects openai-compatible without base_url", () => {
    const result = llmProvidersSchema.safeParse({
      providers: {
        local: {
          type: "openai-compatible",
        },
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("base_url");
    }
  });

  it("requires type when the provider key is not a built-in name", () => {
    const result = llmProvidersSchema.safeParse({
      providers: {
        my_llm: {},
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("type is required");
    }
  });
});
