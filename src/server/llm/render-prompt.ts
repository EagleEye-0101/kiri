/** Matches bundle `{{VAR}}` placeholders — ASCII uppercase names only. */
const PLACEHOLDER_RE = /\{\{[A-Z_][A-Z0-9_]*\}\}/;

/**
 * Substitute `{{VAR}}` placeholders from `vars` in a single left-to-right
 * pass. Unknown names resolve to empty. Substituted values are not
 * re-scanned, so a value containing `{{X}}` stays literal.
 */
export const renderPrompt = (
  template: string,
  vars: Readonly<Record<string, string | undefined>>,
): string => {
  let out = "";
  let rest = template;
  while (true) {
    const match = rest.match(PLACEHOLDER_RE);
    if (!match || match.index === undefined) {
      out += rest;
      break;
    }
    const token = match[0];
    const name = token.slice(2, -2);
    out += rest.slice(0, match.index);
    out += vars[name] ?? "";
    rest = rest.slice(match.index + token.length);
  }
  return out;
};
