import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { type LanguageModel, generateText } from "ai";
import type { LlmRegistry } from "./registry.ts";

/** Token usage surfaced on step traces after an LLM completion. */
export interface LlmTextUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
}

export interface GenerateLlmTextParams {
  /** Provider and model id in `provider:model` form. */
  model: string;
  prompt: string;
  abortSignal?: AbortSignal;
}

export interface GenerateLlmTextResult {
  text: string;
  usage: LlmTextUsage;
}

type GenerateTextFn = typeof generateText;

const parseModelId = (id: string): { providerName: string; modelName: string } => {
  const colon = id.indexOf(":");
  if (colon <= 0 || colon === id.length - 1) {
    throw new Error(`model id must be in provider:model form, got "${id}"`);
  }
  return { providerName: id.slice(0, colon), modelName: id.slice(colon + 1) };
};

const readApiKey = (apiKeyEnv?: string): string | undefined => {
  if (!apiKeyEnv) return undefined;
  return process.env[apiKeyEnv];
};

const buildLanguageModel = (
  registry: LlmRegistry,
  providerName: string,
  modelName: string,
): LanguageModel => {
  const provider = registry.getProvider(providerName);
  if (!provider) {
    const configured = registry.listProviders().map((entry) => entry.name);
    const suffix = configured.length > 0 ? configured.join(", ") : "none configured";
    throw new Error(`unknown LLM provider "${providerName}" (${suffix})`);
  }

  const apiKey = readApiKey(provider.apiKeyEnv);

  switch (provider.type) {
    case "anthropic": {
      const client = createAnthropic({ apiKey });
      return client(modelName);
    }
    case "openai": {
      const client = createOpenAI({ apiKey });
      return client(modelName);
    }
    case "openai-compatible": {
      if (!provider.baseUrl) {
        throw new Error(`provider "${providerName}": base_url is required`);
      }
      const client = createOpenAICompatible({
        name: providerName,
        baseURL: provider.baseUrl,
        apiKey,
      });
      return client(modelName);
    }
  }
};

/**
 * Resolve a `provider:model` id against the live provider registry and return
 * an AI SDK language model handle. Unknown provider prefixes throw with the
 * configured provider names listed.
 */
export const resolveModel = (registry: LlmRegistry, id: string): LanguageModel => {
  const { providerName, modelName } = parseModelId(id);
  return buildLanguageModel(registry, providerName, modelName);
};

const toUsage = (usage: Awaited<ReturnType<GenerateTextFn>>["usage"]): LlmTextUsage => ({
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  cachedInputTokens: usage.cachedInputTokens,
  totalTokens: usage.totalTokens,
});

/**
 * Run a non-streaming LLM completion through the AI SDK. Provider API errors
 * bubble with the provider message; resolved API key values are never included
 * in thrown errors.
 */
export const generateLlmText = async (
  registry: LlmRegistry,
  params: GenerateLlmTextParams,
  generateTextImpl: GenerateTextFn = generateText,
): Promise<GenerateLlmTextResult> => {
  const languageModel = resolveModel(registry, params.model);
  const result = await generateTextImpl({
    model: languageModel,
    prompt: params.prompt,
    abortSignal: params.abortSignal,
  });
  return { text: result.text, usage: toUsage(result.usage) };
};
