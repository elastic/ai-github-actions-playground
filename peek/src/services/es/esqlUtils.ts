// ---------------------------------------------------------------------------
// Shared ES|QL escaping and validation utilities
// ---------------------------------------------------------------------------

/** Escape a string value for use inside ES|QL double-quoted literals */
export function escapeEsqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Escape an ES|QL identifier (field name) with backtick quoting */
export function escapeEsqlIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

/** Validate an ES|QL identifier (field name) to prevent injection */
const SAFE_IDENTIFIER_RE = /^[A-Za-z_@][A-Za-z0-9_.@-]*$/;
export function validateEsqlIdentifier(key: string): string {
  if (!SAFE_IDENTIFIER_RE.test(key)) {
    throw new Error(`Invalid field name: ${key}`);
  }
  return key;
}

/** Validate an ES|QL index pattern used in FROM clauses */
const SAFE_INDEX_PATTERN_RE = /^[A-Za-z0-9*_.-]+(?:,[A-Za-z0-9*_.-]+)*$/;
export function validateEsqlIndexPattern(indexPattern: string): string {
  if (!SAFE_INDEX_PATTERN_RE.test(indexPattern)) {
    throw new Error(`Invalid index pattern: ${indexPattern}`);
  }
  return indexPattern;
}
