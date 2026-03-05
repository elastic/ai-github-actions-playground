import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HashRouter, MemoryRouter } from "react-router-dom";

import EmptyState from "../../src/components/EmptyState";

describe("EmptyState", () => {
  it("renders the Add data link using React Router navigation", () => {
    render(
      <HashRouter>
        <EmptyState heading="No data" addDataHref="/add-data" />
      </HashRouter>,
    );

    const link = screen.getByRole("link", { name: /add data/i });
    expect(link).toBeInTheDocument();
    // HashRouter renders hash-based app routes, not server paths
    expect(link).toHaveAttribute("href", "#/add-data");
  });

  it("does not render Add data link when addDataHref is not provided", () => {
    render(
      <MemoryRouter>
        <EmptyState heading="No data" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /add data/i })).not.toBeInTheDocument();
  });

  it("renders the full description text without truncation", () => {
    const longDescription =
      "Pick a namespace to see an overview of all its metrics, or search for a specific metric field.";
    render(
      <MemoryRouter>
        <EmptyState heading="Explore your metrics" description={longDescription} />
      </MemoryRouter>,
    );

    const descEl = screen.getByText(longDescription);
    expect(descEl).toBeInTheDocument();
    expect(descEl).not.toHaveStyle({ overflow: "hidden" });
  });
});
