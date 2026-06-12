import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { llmProvidersSchema } from "../../src/server/llm/schema.ts";
import { workflowSchema } from "../../src/server/workflows/schema.ts";

const EXAMPLES = join(import.meta.dir, "..", "..", "examples");

describe("examples/ fixtures", () => {
  let savedAnthropicKey: string | undefined;

  beforeEach(() => {
    savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "examples-schema-test";
  });

  afterEach(() => {
    if (savedAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
  });

  it("llm-providers.yaml validates against the published schema", () => {
    const raw = readFileSync(join(EXAMPLES, "llm-providers.yaml"), "utf8");
    const parsed = Bun.YAML.parse(raw);
    const result = llmProvidersSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("daily-briefing-llm.yaml validates and references an on-disk prompt", () => {
    const raw = readFileSync(join(EXAMPLES, "workflows", "daily-briefing-llm.yaml"), "utf8");
    const parsed = Bun.YAML.parse(raw);
    const result = workflowSchema.safeParse(parsed);
    expect(result.success).toBe(true);
    expect(existsSync(join(EXAMPLES, "prompts", "daily-briefing-llm.tpl"))).toBe(true);
  });
});
