import type { LlmProviderDefinition } from "./schema.ts";

/**
 * In-memory LLM provider registry. Holds the current set of provider
 * definitions hydrated from `<cwd>/llm-providers.yaml`. Mutated by the loader
 * via `replace`; read by callers via `getProvider` and `listProviders`.
 */
export interface LlmRegistry {
  getProvider(name: string): LlmProviderDefinition | undefined;
  listProviders(): LlmProviderDefinition[];
  /**
   * Swap the registry's contents wholesale. The map is stored by reference
   * to avoid copying on every reload; the caller must treat the map as owned
   * by the registry from this point on and not mutate it.
   */
  replace(providers: ReadonlyMap<string, LlmProviderDefinition>): void;
}

/** Create an empty LLM provider registry. */
export function createLlmRegistry(): LlmRegistry {
  let providers: ReadonlyMap<string, LlmProviderDefinition> = new Map();
  return {
    getProvider: (name) => providers.get(name),
    listProviders: () => Array.from(providers.values()),
    replace: (next) => {
      providers = next;
    },
  };
}
