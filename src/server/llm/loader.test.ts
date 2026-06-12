import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLlmProviders } from "./loader.ts";

describe("loadLlmProviders", () => {
  let cwd: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "kiri-llm-loader-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
    process.env = { ...originalEnv };
  });

  it("returns an empty map when llm-providers.yaml is absent", () => {
    const providers = loadLlmProviders(cwd);
    expect(providers.size).toBe(0);
  });

  it("hydrates valid providers into the registry map", () => {
    process.env.TEST_OPENAI_KEY = "secret";
    writeFileSync(
      join(cwd, "llm-providers.yaml"),
      `providers:
  openai:
    api_key:
      env: TEST_OPENAI_KEY
  local:
    type: openai-compatible
    base_url: http://127.0.0.1:1234/v1
`,
    );

    const providers = loadLlmProviders(cwd);
    expect(providers.size).toBe(2);
    expect(providers.get("openai")).toEqual({
      name: "openai",
      type: "openai",
      apiKeyEnv: "TEST_OPENAI_KEY",
    });
    expect(providers.get("local")).toEqual({
      name: "local",
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234/v1",
      apiKeyEnv: undefined,
    });
  });

  it("throws when a declared api_key env ref is missing", () => {
    writeFileSync(
      join(cwd, "llm-providers.yaml"),
      `providers:
  anthropic:
    api_key:
      env: KIRI_TEST_UNSET_LLM_PROVIDER_KEY
`,
    );

    expect(() => loadLlmProviders(cwd)).toThrow(/KIRI_TEST_UNSET_LLM_PROVIDER_KEY/);
  });

  it("throws when openai-compatible omits base_url", () => {
    writeFileSync(
      join(cwd, "llm-providers.yaml"),
      `providers:
  local:
    type: openai-compatible
`,
    );

    expect(() => loadLlmProviders(cwd)).toThrow(/base_url/);
  });
});
