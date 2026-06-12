/** Per-stream cap before truncation — keeps inlined context within model windows. */
export const RUN_CONTEXT_STREAM_CAP_BYTES = 64 * 1024;

const TRUNCATED_MARKER = "\n[truncated]";

/**
 * Truncate a stdout/stderr stream beyond `cap` bytes, appending an explicit
 * `[truncated]` marker so downstream readers know content was clipped.
 */
export const truncateRunContextStream = (
  text: string,
  cap = RUN_CONTEXT_STREAM_CAP_BYTES,
): string => {
  if (Buffer.byteLength(text, "utf8") <= cap) return text;
  let bytes = 0;
  let end = 0;
  for (const char of text) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (bytes + charBytes > cap) break;
    bytes += charBytes;
    end += char.length;
  }
  return `${text.slice(0, end)}${TRUNCATED_MARKER}`;
};

export interface RunContextStep {
  index: number;
  status: string;
  durationMs: number;
  stdout: string;
  stderr: string;
  error: { message: string; stack?: string } | null;
  [key: string]: unknown;
}

export interface RunContextArticle {
  slug: string;
  name: string;
  content_md: string;
}

export interface RunContextEnvelope {
  workflow: string;
  status: string;
  startedAt: string;
  durationMs: number;
  steps: RunContextStep[];
  articles?: RunContextArticle[];
}

/**
 * Serialise a run-context envelope for `{{KIRI_RUN_CONTEXT}}` inlining,
 * truncating each step's stdout and stderr beyond the per-stream cap.
 */
export const buildRunContext = (envelope: RunContextEnvelope): string =>
  JSON.stringify(
    {
      ...envelope,
      steps: envelope.steps.map((step) => ({
        ...step,
        stdout: truncateRunContextStream(step.stdout),
        stderr: truncateRunContextStream(step.stderr),
      })),
    },
    null,
    2,
  );
