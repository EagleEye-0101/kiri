import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type LlmProviderDefinition, llmProvidersSchema, resolveProviderEntry } from "./schema.ts";

export const LLM_PROVIDERS_FILENAME = "llm-providers.yaml";

/** Absolute path of the workspace-level LLM providers config file. */
export const llmProvidersPath = (cwd: string): string => join(cwd, LLM_PROVIDERS_FILENAME);

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Parse and validate `<cwd>/llm-providers.yaml`, returning a map of provider
 * definitions keyed by name. A missing file yields an empty map. Validation
 * failures throw with a clear error naming the offending provider or field.
 */
export function loadLlmProviders(cwd: string): Map<string, LlmProviderDefinition> {
  const path = llmProvidersPath(cwd);
  if (!existsSync(path)) {
    return new Map();
  }

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(`llm-providers: failed to read ${path}: ${reasonOf(cause)}`);
  }

  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(raw);
  } catch (cause) {
    throw new Error(`llm-providers: failed to parse ${path}: ${reasonOf(cause)}`);
  }

  const result = llmProvidersSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`llm-providers: ${result.error.message}`);
  }

  const providers = new Map<string, LlmProviderDefinition>();
  for (const [name, entry] of Object.entries(result.data.providers)) {
    const { type, apiKeyEnv } = resolveProviderEntry(name, entry);
    providers.set(name, {
      name,
      type,
      baseUrl: entry.base_url,
      apiKeyEnv,
    });
  }
  return providers;
}
