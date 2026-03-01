import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { axe } from "vitest-axe";
import { expect } from "vitest";

/**
 * Renders a React element and runs an axe accessibility check on the result.
 *
 * Usage:
 * ```ts
 * const result = await renderWithA11y(<MyComponent />);
 * ```
 */
export async function renderWithA11y(
  ui: React.ReactElement,
  options?: RenderOptions,
): Promise<RenderResult> {
  const result = render(ui, options);
  const a11yResults = await axe(result.container);
  expect(a11yResults).toHaveNoViolations();
  return result;
}
