import { describe, expect, it } from "bun:test";
import { llmProvidersJsonSchema } from "./json-schema.ts";

describe("llmProvidersJsonSchema", () => {
  it("emits a Draft 2020-12 JSON Schema with providers required", () => {
    const schema = llmProvidersJsonSchema();
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.required).toContain("providers");
  });
});
