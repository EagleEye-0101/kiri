import { z } from "zod";

/** Built-in provider keys whose `type` may be omitted (defaults to the key). */
export const BUILTIN_PROVIDER_KEYS = new Set(["anthropic", "openai", "openai-compatible"] as const);

export const providerTypeSchema = z.enum(["anthropic", "openai", "openai-compatible"]);

export type ProviderType = z.infer<typeof providerTypeSchema>;

const apiKeyRefSchema = z
  .object({
    env: z
      .string()
      .min(1)
      .describe(
        "Name of an environment variable holding the API key. Literal strings are not allowed — secrets must not live in git-tracked YAML.",
      ),
  })
  .strict();

const providerEntrySchema = z
  .object({
    type: providerTypeSchema
      .optional()
      .describe(
        "Provider adapter to use. Defaults to the entry's key when the key is a built-in name (`anthropic`, `openai`, `openai-compatible`); required otherwise.",
      ),
    base_url: z
      .string()
      .min(1)
      .optional()
      .describe("API base URL. Required for `openai-compatible` providers."),
    api_key: apiKeyRefSchema
      .optional()
      .describe(
        "API key sourced from an environment variable. When omitted, `anthropic` and `openai` fall back to `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`; `openai-compatible` needs no key.",
      ),
  })
  .strict();

const baseLlmProvidersSchema = z
  .object({
    providers: z
      .record(z.string().min(1), providerEntrySchema)
      .describe("Named LLM provider endpoints referenced by `llm:` workflow steps."),
  })
  .strict();

export type LlmProviderEntry = z.infer<typeof providerEntrySchema>;

export type LlmProvidersFile = z.infer<typeof baseLlmProvidersSchema>;

/** Resolved provider definition hydrated from `llm-providers.yaml`. */
export interface LlmProviderDefinition {
  /** Key in the `providers:` map. */
  name: string;
  type: ProviderType;
  baseUrl?: string;
  /** Env var name for the API key, when one applies. Never holds the resolved secret. */
  apiKeyEnv?: string;
}

const DEFAULT_API_KEY_ENV: Record<"anthropic" | "openai", string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

/**
 * Resolve a raw provider entry's effective `type` and optional API-key env var
 * name. Does not read `process.env` — callers validate declared refs separately.
 */
export const resolveProviderEntry = (
  name: string,
  entry: LlmProviderEntry,
): { type: ProviderType; apiKeyEnv?: string } => {
  const type =
    entry.type ??
    (BUILTIN_PROVIDER_KEYS.has(name as ProviderType) ? (name as ProviderType) : undefined);
  if (!type || !providerTypeSchema.safeParse(type).success) {
    throw new Error(
      `provider "${name}": type is required when the key is not a built-in name (anthropic, openai, openai-compatible)`,
    );
  }
  if (type === "openai-compatible") {
    return { type, apiKeyEnv: entry.api_key?.env };
  }
  const apiKeyEnv = entry.api_key?.env ?? DEFAULT_API_KEY_ENV[type];
  return { type, apiKeyEnv };
};

/**
 * Zod schema for `llm-providers.yaml`. Cross-validates provider entries:
 * `openai-compatible` requires `base_url`; declared `{ env: }` refs must name
 * a variable present in the kiri process at load time.
 */
export const llmProvidersSchema = baseLlmProvidersSchema.superRefine((file, ctx) => {
  for (const [name, entry] of Object.entries(file.providers)) {
    let type: ProviderType;
    try {
      ({ type } = resolveProviderEntry(name, entry));
    } catch (cause) {
      ctx.addIssue({
        code: "custom",
        message: cause instanceof Error ? cause.message : String(cause),
        path: ["providers", name, "type"],
      });
      continue;
    }

    if (type === "openai-compatible" && !entry.base_url) {
      ctx.addIssue({
        code: "custom",
        message: `provider "${name}": base_url is required for openai-compatible`,
        path: ["providers", name, "base_url"],
      });
    }

    if (entry.api_key?.env && process.env[entry.api_key.env] === undefined) {
      ctx.addIssue({
        code: "custom",
        message: `provider "${name}": environment variable "${entry.api_key.env}" is not set`,
        path: ["providers", name, "api_key", "env"],
      });
    }
  }
});
