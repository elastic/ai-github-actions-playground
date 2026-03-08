import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { renderWithA11y } from "../helpers/renderWithA11y";
import ScrollableLayout from "../../src/components/ScrollableLayout";

describe("ScrollableLayout", () => {
  it("has no accessibility violations", async () => {
    await renderWithA11y(
      <ScrollableLayout header={<h2>Title</h2>} footer={<footer>Done</footer>}>
        <p>Body</p>
      </ScrollableLayout>,
    );
  });

  it("renders header, children, and footer", () => {
    render(
      <ScrollableLayout header={<div>Header</div>} footer={<div>Footer</div>}>
        <div>Content</div>
      </ScrollableLayout>,
    );

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("renders without header or footer", () => {
    render(
      <ScrollableLayout>
        <div>Only content</div>
      </ScrollableLayout>,
    );

    expect(screen.getByText("Only content")).toBeInTheDocument();
  });

  it("wraps children in a body container between header and footer", () => {
    const { container } = render(
      <ScrollableLayout
        header={<div data-testid="hd">H</div>}
        footer={<div data-testid="ft">F</div>}
      >
        <div data-testid="inner">Content</div>
      </ScrollableLayout>,
    );

    const outer = container.firstElementChild!;
    // The outer flex container should have three direct children: header wrapper, body, footer wrapper
    expect(outer.children.length).toBe(3);
    // The body (middle child) should contain our inner content
    expect(outer.children[1].querySelector("[data-testid='inner']")).not.toBeNull();
  });
});
