// ---------------------------------------------------------------------------
// ES|QL query-text parsing and formatting utilities
//
// These are generic query-text operations that are used across multiple
// features (Discover, PanelEditor, QueryPipelineSteps, etc.).  They live
// under services/es so that non-Discover consumers do not depend on a
// Discover-scoped component file.
// ---------------------------------------------------------------------------

/**
 * Splits an ES|QL query on top-level pipe characters, respecting single-quoted
 * strings (`'...'` with `''` and `\'` escaping), double-quoted strings
 * (`"..."` with `""` and `\"` escaping), triple-quoted strings (`"""..."""`),
 * backtick-quoted identifiers (`` `...` ``), and line/block comments.
 *
 * Returns an array of trimmed pipeline stage strings.  Returns an empty array
 * for a blank query, and a single-element array when no pipes are present.
 */
export function splitEsqlPipeline(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const steps: string[] = [];
  let current = "";
  let i = 0;

  while (i < trimmed.length) {
    const ch = trimmed[i]!;

    if (ch === "'") {
      // Single-quoted string — '' is the escape sequence for a literal '
      // Backslash also escapes the next character (e.g. \' does not close).
      current += ch;
      i++;
      while (i < trimmed.length) {
        const c = trimmed[i]!;
        current += c;
        i++;
        if (c === "\\") {
          if (i < trimmed.length) {
            current += trimmed[i]!;
            i++;
          }
        } else if (c === "'") {
          if (trimmed[i] === "'") {
            current += "'";
            i++;
          } else {
            break;
          }
        }
      }
    } else if (ch === '"') {
      if (trimmed[i + 1] === '"' && trimmed[i + 2] === '"') {
        // Triple-quoted string: """..."""
        current += '"""';
        i += 3;
        while (i < trimmed.length) {
          if (trimmed[i] === '"' && trimmed[i + 1] === '"' && trimmed[i + 2] === '"') {
            current += '"""';
            i += 3;
            break;
          }
          current += trimmed[i++]!;
        }
      } else {
        // Regular double-quoted string — "" or \" are escape sequences for "
        // Backslash also escapes the next character (e.g. \\ is a literal \).
        current += ch;
        i++;
        while (i < trimmed.length) {
          const c = trimmed[i]!;
          current += c;
          i++;
          if (c === "\\") {
            if (i < trimmed.length) {
              current += trimmed[i]!;
              i++;
            }
          } else if (c === '"') {
            if (trimmed[i] === '"') {
              current += '"';
              i++;
            } else {
              break;
            }
          }
        }
      }
    } else if (ch === "`") {
      // Backtick-quoted identifier (e.g. `field name`).  ES|QL does not allow
      // a literal backtick inside a backtick-quoted identifier, so no escape
      // sequences need to be handled here.
      current += ch;
      i++;
      while (i < trimmed.length) {
        const c = trimmed[i]!;
        current += c;
        i++;
        if (c === "`") break;
      }
    } else if (ch === "/" && trimmed[i + 1] === "/") {
      // Line comment: // ...
      current += "//";
      i += 2;
      while (i < trimmed.length) {
        const c = trimmed[i]!;
        current += c;
        i++;
        if (c === "\n") break;
      }
    } else if (ch === "/" && trimmed[i + 1] === "*") {
      // Block comment: /* ... */
      current += "/*";
      i += 2;
      while (i < trimmed.length) {
        const c = trimmed[i]!;
        current += c;
        i++;
        if (c === "*" && trimmed[i] === "/") {
          current += "/";
          i++;
          break;
        }
      }
    } else if (ch === "|") {
      const step = current.trim();
      if (step) steps.push(step);
      current = "";
      i++;
    } else {
      current += ch;
      i++;
    }
  }

  const last = current.trim();
  if (last) steps.push(last);

  return steps;
}

/**
 * Formats an ES|QL query into a clean, consistent style:
 * - Uppercases the leading command keyword of each pipeline stage.
 * - Joins multiple stages with a newline + "| " prefix for readability.
 *
 * Returns the original query unchanged if it has no pipeline steps.
 */
export function formatEsqlQuery(query: string): string {
  const steps = splitEsqlPipeline(query);
  if (steps.length === 0) return query;

  const formattedSteps = steps.map((step) =>
    step.replace(/^([A-Za-z]+)/, (match) => match.toUpperCase()),
  );

  return formattedSteps.join("\n| ");
}
