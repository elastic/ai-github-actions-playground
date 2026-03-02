import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import EmptyState from "../../src/components/EmptyState";

describe("EmptyState", () => {
  it("renders the Add data link using React Router navigation", () => {
    render(
      <MemoryRouter>
        <EmptyState heading="No data" addDataHref="/add-data" />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /add data/i });
    expect(link).toBeInTheDocument();
    // React Router Link renders with href that respects the router context
    expect(link).toHaveAttribute("href", "/add-data");
  });

  it("does not render Add data link when addDataHref is not provided", () => {
    render(
      <MemoryRouter>
        <EmptyState heading="No data" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /add data/i })).not.toBeInTheDocument();
  });
});
