import { describe, expect, it } from "bun:test";
import { renderPrompt } from "./render-prompt.ts";

describe("renderPrompt", () => {
  it("substitutes known vars left-to-right", () => {
    expect(renderPrompt("Hello {{NAME}}!", { NAME: "world" })).toBe("Hello world!");
  });

  it("resolves unknown vars to empty", () => {
    expect(renderPrompt("{{MISSING}}tail", {})).toBe("tail");
  });

  it("does not re-scan substituted values", () => {
    expect(renderPrompt("{{A}}{{B}}", { A: "{{B}}", B: "ok" })).toBe("{{B}}ok");
  });

  it("handles multi-line templates", () => {
    const template = "line1 {{X}}\nline2 {{Y}}";
    expect(renderPrompt(template, { X: "one", Y: "two" })).toBe("line1 one\nline2 two");
  });

  it("respects name boundaries (no partial matches)", () => {
    expect(renderPrompt("{{FOO}}_{{FOOBAR}}", { FOO: "a", FOOBAR: "b" })).toBe("a_b");
  });

  it("ignores lowercase placeholder-like text", () => {
    expect(renderPrompt("{{foo}}", { foo: "nope" })).toBe("{{foo}}");
  });
});
