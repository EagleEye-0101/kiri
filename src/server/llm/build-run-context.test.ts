import { describe, expect, it } from "bun:test";
import {
  RUN_CONTEXT_STREAM_CAP_BYTES,
  buildRunContext,
  truncateRunContextStream,
} from "./build-run-context.ts";

describe("truncateRunContextStream", () => {
  it("leaves under-cap streams untouched", () => {
    expect(truncateRunContextStream("hello")).toBe("hello");
  });

  it("marks over-cap streams with [truncated]", () => {
    const big = "x".repeat(RUN_CONTEXT_STREAM_CAP_BYTES + 10);
    const result = truncateRunContextStream(big);
    expect(result.endsWith("\n[truncated]")).toBe(true);
    expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(
      RUN_CONTEXT_STREAM_CAP_BYTES + Buffer.byteLength("\n[truncated]", "utf8") + 1,
    );
  });
});

describe("buildRunContext", () => {
  it("produces valid JSON with truncated step streams", () => {
    const stdout = "a".repeat(RUN_CONTEXT_STREAM_CAP_BYTES + 1);
    const json = buildRunContext({
      workflow: "wf",
      status: "ok",
      startedAt: "2026-01-01T00:00:00.000Z",
      durationMs: 1,
      steps: [
        {
          index: 0,
          status: "ok",
          durationMs: 1,
          stdout,
          stderr: "",
          error: null,
        },
      ],
    });
    const parsed = JSON.parse(json);
    expect(parsed.workflow).toBe("wf");
    expect(parsed.steps[0].stdout.endsWith("\n[truncated]")).toBe(true);
  });
});
