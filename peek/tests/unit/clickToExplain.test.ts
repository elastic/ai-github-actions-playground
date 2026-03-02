// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";

import { serializeClickedElement } from "../../src/services/clickToExplain";

function makeElement(
  tag: string,
  attrs: Record<string, string> = {},
  textContent = "",
): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  el.textContent = textContent;
  document.body.appendChild(el);
  return el;
}

describe("serializeClickedElement", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("includes the tag name", () => {
    const el = makeElement("button", {}, "Click me");
    const result = serializeClickedElement(el);
    expect(result).toContain("element: <button>");
  });

  it("includes data-testid", () => {
    const el = makeElement("div", { "data-testid": "stat-card-failures" }, "14");
    const result = serializeClickedElement(el);
    expect(result).toContain("data-testid: stat-card-failures");
  });

  it("includes aria-label from closest ancestor", () => {
    const parent = makeElement("div", { "aria-label": "Shard Allocation Failures" });
    const child = document.createElement("span");
    child.textContent = "14";
    parent.appendChild(child);
    const result = serializeClickedElement(child);
    expect(result).toContain("aria-label: Shard Allocation Failures");
  });

  it("includes role from closest ancestor", () => {
    const parent = makeElement("div", { role: "button" });
    const child = document.createElement("span");
    child.textContent = "Click";
    parent.appendChild(child);
    const result = serializeClickedElement(child);
    expect(result).toContain("role: button");
  });

  it("includes visible text content", () => {
    const el = makeElement("span", {}, "Error count: 42");
    const result = serializeClickedElement(el);
    expect(result).toContain('text: "Error count: 42"');
  });

  it("truncates long text content", () => {
    const longText = "x".repeat(300);
    const el = makeElement("span", {}, longText);
    const result = serializeClickedElement(el);
    expect(result).toContain("…");
    expect(result.length).toBeLessThan(longText.length + 100);
  });

  it("includes heading context", () => {
    const heading = makeElement("h2", {}, "Cluster Health");
    const child = document.createElement("span");
    child.textContent = "green";
    heading.appendChild(child);
    const result = serializeClickedElement(child);
    expect(result).toContain('heading: "Cluster Health');
  });
});
