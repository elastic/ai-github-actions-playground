/**
 * Extracts semantic context from a clicked DOM element for the "explain this" feature.
 * Walks up the DOM to find the closest meaningful boundary and serializes
 * relevant context (aria labels, data-testid, text content, table/panel context).
 */
export function serializeClickedElement(target: HTMLElement): string {
  const parts: string[] = [];

  const testId = getClosestTestId(target);
  if (testId) parts.push(`data-testid: ${testId}`);

  const ariaLabel = getClosestAriaLabel(target);
  if (ariaLabel) parts.push(`aria-label: ${ariaLabel}`);

  const role = target.closest("[role]")?.getAttribute("role");
  if (role) parts.push(`role: ${role}`);

  const tagName = target.tagName.toLowerCase();
  parts.push(`element: <${tagName}>`);

  const textContent = getVisibleText(target);
  if (textContent) parts.push(`text: "${textContent}"`);

  const heading = target.closest("h1, h2, h3, h4, h5, h6");
  if (heading) {
    const headingText = sanitize(heading.textContent ?? "", 100);
    if (headingText) parts.push(`heading: "${headingText}"`);
  }

  const tableContext = getTableContext(target);
  if (tableContext) parts.push(tableContext);

  const panelTitle = getPanelTitle(target);
  if (panelTitle) parts.push(`panel: "${panelTitle}"`);

  return parts.join(", ");
}

/** Strip control characters and truncate to a safe length. */
function sanitize(raw: string, maxLen = 200): string {
  // Strip control characters (U+0000–U+001F except tab/LF/CR, plus U+007F)
  // eslint-disable-next-line no-control-regex
  const clean = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean;
}

function getClosestTestId(el: HTMLElement): string | null {
  const withTestId = el.closest("[data-testid]");
  const raw = withTestId?.getAttribute("data-testid") ?? null;
  return raw ? sanitize(raw, 100) : null;
}

function getClosestAriaLabel(el: HTMLElement): string | null {
  const withLabel = el.closest("[aria-label]");
  const raw = withLabel?.getAttribute("aria-label") ?? null;
  return raw ? sanitize(raw, 200) : null;
}

function getVisibleText(el: HTMLElement): string {
  return sanitize(el.textContent ?? "");
}

/**
 * When the clicked element is inside a table, extracts the column header for
 * the clicked cell plus the values of other cells in the same row.
 */
function getTableContext(el: HTMLElement): string | null {
  const cell = el.closest("td, th");
  if (!cell) return null;

  const table = cell.closest("table");
  if (!table) return null;

  const context: { columns?: string[]; column?: string; row?: string[] } = {};

  // Extract column headers from thead
  const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
    sanitize(th.textContent ?? "", 50),
  );
  if (headers.length > 0) context.columns = headers;

  // Identify the column of the clicked cell
  const row = cell.closest("tr");
  if (row) {
    const cells = Array.from(row.children);
    const cellIndex = cells.indexOf(cell);
    if (cellIndex >= 0 && cellIndex < headers.length) context.column = headers[cellIndex];

    // Extract row values (limited to avoid overly long output)
    const rowValues = cells.slice(0, 10).map((c) => sanitize(c.textContent ?? "", 50));
    if (rowValues.length > 0) context.row = rowValues;
  }

  return Object.keys(context).length > 0 ? `table(${JSON.stringify(context)})` : null;
}

/**
 * Walks up the DOM to find the closest dashboard panel and returns its title.
 * Panels are identified by common container patterns: elements with a
 * panel-drag-handle child (PanelContainer) or section/article landmarks.
 */
function getPanelTitle(el: HTMLElement): string | null {
  const panelRoot = el.closest(".panel-root");
  const dragHandle = panelRoot?.querySelector(".panel-drag-handle");
  if (dragHandle) {
    const titleEl = dragHandle.parentElement?.querySelector("p, span, h1, h2, h3, h4, h5, h6");
    const title = sanitize(titleEl?.textContent ?? "", 100);
    if (title) return title;
  }

  const landmarkPanel = el.closest("section[aria-label], article[aria-label]");
  if (landmarkPanel) return sanitize(landmarkPanel.getAttribute("aria-label") ?? "", 100);

  return null;
}
