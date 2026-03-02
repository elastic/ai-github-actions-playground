import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

import "../fixtures/mockNuqs";
import DocsPage from "../../src/components/DocsPage";
import { resetAllStores } from "../fixtures/test-utils";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname + location.search}</div>;
}

describe("DocsPage", () => {
  beforeEach(() => {
    resetAllStores();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("hydrates search input from ?q", async () => {
    render(
      <MemoryRouter initialEntries={["/docs?q=keyboard"]}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("textbox", { name: "Search docs" })).toHaveValue("keyboard");
  });

  it("writes ?q as docs search changes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/docs"]}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>,
    );

    const input = await screen.findByRole("textbox", { name: "Search docs" });
    await user.type(input, "connect");

    await waitFor(() => {
      expect(screen.getByTestId("location-display").textContent).toBe("/docs?q=connect");
    });
  });

  it("preserves ?q when changing sections", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/docs?q=keyboard"]}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Tips & Shortcuts" }));

    await waitFor(() => {
      const text = screen.getByTestId("location-display").textContent ?? "";
      const query = text.split("?")[1] ?? "";
      const params = new URLSearchParams(query);
      expect(params.get("q")).toBe("keyboard");
      expect(params.get("section")).toBe("keyboard-shortcuts");
    });
  });
});
