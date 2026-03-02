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

  it("extracts table column headers and row context when clicking a table cell", () => {
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const name of ["Name", "CPU %", "Memory %"]) {
      const th = document.createElement("th");
      th.textContent = name;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const dataRow = document.createElement("tr");
    for (const value of ["node-1", "42", "78"]) {
      const td = document.createElement("td");
      td.textContent = value;
      dataRow.appendChild(td);
    }
    tbody.appendChild(dataRow);
    table.appendChild(tbody);
    document.body.appendChild(table);

    // Click on the "42" cell (CPU %)
    const cpuCell = dataRow.children[1] as HTMLElement;
    const result = serializeClickedElement(cpuCell);
    expect(result).toContain("columns: [Name, CPU %, Memory %]");
    expect(result).toContain('column: "CPU %"');
    expect(result).toContain("row: [node-1, 42, 78]");
  });

  it("omits table context when element is not inside a table", () => {
    const el = makeElement("span", {}, "42");
    const result = serializeClickedElement(el);
    expect(result).not.toContain("table(");
    expect(result).not.toContain("columns:");
  });

  it("extracts panel title from panel-drag-handle sibling", () => {
    const panel = document.createElement("div");
    const header = document.createElement("div");
    const dragHandle = document.createElement("svg");
    dragHandle.classList.add("panel-drag-handle");
    const title = document.createElement("p");
    title.textContent = "Request Latency";
    header.appendChild(dragHandle);
    header.appendChild(title);
    panel.appendChild(header);

    const content = document.createElement("div");
    const value = document.createElement("span");
    value.textContent = "250ms";
    content.appendChild(value);
    panel.appendChild(content);
    document.body.appendChild(panel);

    const result = serializeClickedElement(value);
    expect(result).toContain('panel: "Request Latency"');
  });

  it("extracts panel title from section with aria-label", () => {
    const section = document.createElement("section");
    section.setAttribute("aria-label", "Error Rate Panel");
    const value = document.createElement("span");
    value.textContent = "5%";
    section.appendChild(value);
    document.body.appendChild(section);

    const result = serializeClickedElement(value);
    expect(result).toContain('panel: "Error Rate Panel"');
  });

  it("omits panel context when element is not inside a panel", () => {
    const el = makeElement("span", {}, "standalone");
    const result = serializeClickedElement(el);
    expect(result).not.toContain("panel:");
  });
});
