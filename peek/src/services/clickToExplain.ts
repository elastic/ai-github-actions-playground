/**
 * Extracts semantic context from a clicked DOM element for the "explain this" feature.
 * Walks up the DOM to find the closest meaningful boundary and serializes
 * relevant context (aria labels, data-testid, text content).
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
