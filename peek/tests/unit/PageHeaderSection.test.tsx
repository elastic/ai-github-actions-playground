import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import PageHeaderSection from "../../src/components/PageHeaderSection";

describe("PageHeaderSection", () => {
  it("renders the title inside a Paper wrapper", () => {
    render(<PageHeaderSection title="My Title" />);
    expect(screen.getByRole("heading", { name: "My Title" })).toBeInTheDocument();
  });

  it("passes actions through to PageHeader", () => {
    render(<PageHeaderSection title="Title" actions={<button>Click me</button>} />);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("passes description through to PageHeader", () => {
    render(<PageHeaderSection title="Title" description="Some description" />);
    expect(screen.getByText("Some description")).toBeInTheDocument();
  });
});
