// ---------------------------------------------------------------------------
// Natural language detection for ES|QL queries
// ---------------------------------------------------------------------------
// Heuristic: detects stretches of text that look like plain English
// (no ES|QL keywords, multi-word, not a field path) within a pipe-delimited
// query. Used to trigger NL-to-ES|QL translation via the LLM.
// ---------------------------------------------------------------------------

export interface NLChunk {
  /** Absolute document position of the start of the NL text */
  from: number;
  /** Absolute document position of the end of the NL text (at cursor) */
  to: number;
  /** The natural language text itself */
  text: string;
}

const ESQL_KEYWORDS =
  /^(FROM|WHERE|STATS|EVAL|KEEP|DROP|SORT|LIMIT|RENAME|DISSECT|GROK|ENRICH|LOOKUP|FORK|INLINE|SAMPLE|ROW|SHOW)\b/i;

const FIELD_PATH = /^[a-zA-Z_@][\w.]*$/;

const MIN_CHUNK_LENGTH = 5;
const MIN_WORD_COUNT = 2;

/**
 * Detect a natural language chunk near the cursor in an ES|QL document.
 * Walks backward from cursor to the last `|` (or line start) and checks
 * whether that text looks like plain English rather than valid ES|QL.
 *
 * Returns null if no NL text is found.
 */
export function detectNaturalLanguage(docText: string, cursorPos: number): NLChunk | null {
  // Find the line containing the cursor
  let lineStart = docText.lastIndexOf("\n", cursorPos - 1) + 1;
  if (lineStart < 0) lineStart = 0;

  const beforeCursor = docText.slice(lineStart, cursorPos);

  // Find the last pipe in the text before cursor on this line
  const lastPipe = beforeCursor.lastIndexOf("|");
  const chunkStartInLine = lastPipe >= 0 ? lastPipe + 1 : 0;
  const rawChunk = beforeCursor.slice(chunkStartInLine);
  const chunk = rawChunk.trim();

  // Too short to be meaningful
  if (chunk.length < MIN_CHUNK_LENGTH) return null;

  // Starts with an ES|QL keyword — this is valid syntax, not NL
  if (ESQL_KEYWORDS.test(chunk)) return null;

  // Single word — likely a field name or partial keyword
  const wordCount = chunk.split(/\s+/).length;
  if (wordCount < MIN_WORD_COUNT) return null;

  // Looks like a dotted field path (e.g. service.name.field)
  if (FIELD_PATH.test(chunk)) return null;

  // Compute absolute positions
  const leadingWhitespace = rawChunk.length - rawChunk.trimStart().length;
  const absoluteFrom = lineStart + chunkStartInLine + leadingWhitespace;
  const absoluteTo = cursorPos;

  // Safety: from must be before to
  if (absoluteFrom >= absoluteTo) return null;

  return { from: absoluteFrom, to: absoluteTo, text: chunk };
}
