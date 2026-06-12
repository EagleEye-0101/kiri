import type { ReactNode } from "react";
import type { EnvValue, LlmConfigSummary } from "../../api.ts";
import { Code, CodeBlock } from "../../design-system/content/code.tsx";

const SH_LABEL_LIMIT = 60;
const PROMPT_EXCERPT_LIMIT = 80;

type LabelSource = ({ use: string } | { sh: string } | { llm: LlmConfigSummary }) & {
  name?: string;
};

/** The kind tag for a step-shaped entry. */
export const stepKind = (entry: LabelSource): "sh" | "use" | "llm" => {
  if ("llm" in entry) return "llm";
  if ("use" in entry) return "use";
  return "sh";
};

/**
 * The title for a step-shaped entry: explicit `name`, else bundle reference,
 * model id for `llm:`, or the first non-empty `sh:` line (truncated).
 */
export const stepTitle = (entry: LabelSource): string => {
  if (entry.name) return entry.name;
  if ("llm" in entry) return entry.llm.model;
  if ("use" in entry) return entry.use;
  const firstNonEmpty =
    entry.sh
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ?? "";
  return firstNonEmpty.length > SH_LABEL_LIMIT
    ? `${firstNonEmpty.slice(0, SH_LABEL_LIMIT)}…`
    : firstNonEmpty;
};

/** Human-readable prompt source for an llm config row. */
export const llmPromptSource = (llm: LlmConfigSummary): string => {
  if (llm.prompt_file) return llm.prompt_file;
  if (llm.prompt) {
    return llm.prompt.length > PROMPT_EXCERPT_LIMIT
      ? `${llm.prompt.slice(0, PROMPT_EXCERPT_LIMIT)}…`
      : llm.prompt;
  }
  return "default summariser prompt";
};

const hasEnv = (env: Record<string, EnvValue> | undefined): env is Record<string, EnvValue> =>
  env !== undefined && Object.keys(env).length > 0;

const renderEnvValue = (value: EnvValue): string =>
  typeof value === "string" ? value : `{ input: ${value.input} }`;

function LabelledBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-xs tracking-widest text-ink-muted uppercase">{label}</span>
      {children}
    </div>
  );
}

type EntryShape = { description?: string; env?: Record<string, EnvValue> } & (
  | { use: string }
  | { sh: string }
  | { llm: LlmConfigSummary }
);

/**
 * The expanded body of a schema entry: bundle reference, llm model and prompt
 * source, optional description, inline `sh:` source, and env map.
 */
export function EntryConfig({ entry }: { entry: EntryShape }) {
  const showReference = "use" in entry;
  const showLlm = "llm" in entry;
  const showDescription = entry.description !== undefined && entry.description.length > 0;
  const showSource = "sh" in entry;
  const showEnv = hasEnv(entry.env);
  return (
    <div className="space-y-4">
      {showReference && (
        <LabelledBlock label={stepKind(entry)}>
          <span className="font-mono text-sm">
            <Code>{(entry as { use: string }).use}</Code>
          </span>
        </LabelledBlock>
      )}
      {showLlm && (
        <>
          <LabelledBlock label="model">
            <span className="font-mono text-sm">
              <Code>{(entry as { llm: LlmConfigSummary }).llm.model}</Code>
            </span>
          </LabelledBlock>
          <LabelledBlock label="prompt">
            <span className="font-mono text-sm text-ink">
              {llmPromptSource((entry as { llm: LlmConfigSummary }).llm)}
            </span>
          </LabelledBlock>
        </>
      )}
      {showDescription && (
        <LabelledBlock label="description">
          <p className="font-display text-base text-ink italic">{entry.description}</p>
        </LabelledBlock>
      )}
      {showSource && (
        <LabelledBlock label={stepKind(entry)}>
          <CodeBlock>{(entry as { sh: string }).sh}</CodeBlock>
        </LabelledBlock>
      )}
      {showEnv && (
        <LabelledBlock label="env">
          <dl className="space-y-1 font-mono text-xs">
            {Object.entries(entry.env as Record<string, EnvValue>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-4">
                  <dt className="w-40 shrink-0 text-ink-muted">{k}</dt>
                  <dd className="min-w-0 flex-1 break-words text-ink">{renderEnvValue(v)}</dd>
                </div>
              ))}
          </dl>
        </LabelledBlock>
      )}
    </div>
  );
}
