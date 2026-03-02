import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import DashboardsLandingPage from "../../src/components/DashboardsLandingPage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { resetAllStores } from "../fixtures/test-utils";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/dashboards"]}>
      <NuqsTestingAdapter hasMemory>
        <DashboardsLandingPage />
        <LocationDisplay />
      </NuqsTestingAdapter>
    </MemoryRouter>,
  );
}

describe("DashboardsLandingPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("renders the heading and dashboard count", () => {
    renderLanding();

    expect(screen.getByText("Dashboards")).toBeInTheDocument();
    expect(screen.getByText(/1 dashboard/)).toBeInTheDocument();
  });

  it("renders a card for each dashboard", () => {
    useDashboardStore.getState().createDashboard("Second");

    renderLanding();

    const dashboards = useDashboardStore.getState().dashboards;
    for (const d of dashboards) {
      expect(screen.getByText(d.title)).toBeInTheDocument();
    }
  });

  it("shows 'Active' chip on the active dashboard card", () => {
    renderLanding();

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("navigates to /dashboards/:id when a card is clicked", async () => {
    const user = userEvent.setup();
    renderLanding();

    const activeId = useDashboardStore.getState().activeDashboardId;
    const card = screen.getByText(useDashboardStore.getState().dashboard.title);
    await user.click(card);

    expect(screen.getByTestId("location")).toHaveTextContent(`/dashboards/${activeId}`);
  });

  it("opens kebab menu with action items", async () => {
    const user = userEvent.setup();
    renderLanding();

    const title = useDashboardStore.getState().dashboard.title;
    await user.click(screen.getByLabelText(`Actions for ${title}`));

    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Archive")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("shows New Dashboard button in toolbar", () => {
    renderLanding();

    expect(screen.getByRole("button", { name: /new dashboard/i })).toBeInTheDocument();
  });

  it("shows import and export buttons in toolbar", () => {
    renderLanding();

    expect(screen.getByRole("button", { name: /^import$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import workspace/i })).toBeInTheDocument();
  });

  it("hides archived dashboards by default", () => {
    const id = useDashboardStore.getState().createDashboard("Archived One");
    useDashboardStore.getState().archiveDashboard(id, true);

    renderLanding();

    expect(screen.queryByText("Archived One")).not.toBeInTheDocument();
  });

  it("shows empty state when no dashboards exist", () => {
    // Delete all dashboards except the last (store prevents deleting last)
    // Create a scenario with zero visible dashboards by archiving all
    const state = useDashboardStore.getState();
    state.archiveDashboard(state.activeDashboardId, true);

    renderLanding();

    // All dashboards are archived, so with default filter they're hidden
    expect(screen.getByText("No dashboards yet")).toBeInTheDocument();
  });

  it("shows archived dashboards when toggle is clicked", async () => {
    const user = userEvent.setup();
    const id = useDashboardStore.getState().createDashboard("Hidden");
    useDashboardStore.getState().archiveDashboard(id, true);

    renderLanding();

    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show archived/i }));

    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("opens in-app dialog when New Dashboard is clicked", async () => {
    const user = userEvent.setup();
    renderLanding();

    await user.click(screen.getByRole("button", { name: /new dashboard/i }));

    expect(screen.getByRole("dialog", { name: /new dashboard/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/dashboard name/i)).toBeInTheDocument();
  });

  it("creates a dashboard via the in-app dialog and navigates to it", async () => {
    const user = userEvent.setup();
    renderLanding();

    await user.click(screen.getByRole("button", { name: /new dashboard/i }));

    const dialog = screen.getByRole("dialog", { name: /new dashboard/i });
    const input = within(dialog).getByLabelText(/dashboard name/i);
    await user.clear(input);
    await user.type(input, "My New Dashboard");
    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(
      useDashboardStore.getState().dashboards.some((d) => d.title === "My New Dashboard"),
    ).toBe(true);
  });

  it("cancels dashboard creation without creating a dashboard", async () => {
    const user = userEvent.setup();
    const countBefore = useDashboardStore.getState().dashboards.length;
    renderLanding();

    await user.click(screen.getByRole("button", { name: /new dashboard/i }));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(useDashboardStore.getState().dashboards.length).toBe(countBefore);
  });

  it("opens in-app dialog when Rename is clicked from the menu", async () => {
    const user = userEvent.setup();
    renderLanding();

    const title = useDashboardStore.getState().dashboard.title;
    await user.click(screen.getByLabelText(`Actions for ${title}`));
    await user.click(screen.getByText("Rename"));

    expect(screen.getByRole("dialog", { name: /rename dashboard/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/dashboard name/i)).toHaveValue(title);
  });

  it("renames a dashboard via the in-app dialog", async () => {
    const user = userEvent.setup();
    renderLanding();

    const title = useDashboardStore.getState().dashboard.title;
    await user.click(screen.getByLabelText(`Actions for ${title}`));
    await user.click(screen.getByText("Rename"));

    const dialog = screen.getByRole("dialog", { name: /rename dashboard/i });
    const input = within(dialog).getByLabelText(/dashboard name/i);
    await user.clear(input);
    await user.type(input, "Renamed Dashboard");
    await user.click(within(dialog).getByRole("button", { name: /^rename$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(
      useDashboardStore.getState().dashboards.some((d) => d.title === "Renamed Dashboard"),
    ).toBe(true);
  });

  it("shows inline confirm/cancel when Delete is clicked from the menu", async () => {
    useDashboardStore.getState().createDashboard("Extra");
    const user = userEvent.setup();
    renderLanding();

    const title = useDashboardStore.getState().dashboards[0].title;
    await user.click(screen.getByLabelText(`Actions for ${title}`));
    await user.click(screen.getByText("Delete"));

    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });

  it("deletes a dashboard after confirming in the menu", async () => {
    const extraId = useDashboardStore.getState().createDashboard("To Delete");
    const user = userEvent.setup();
    renderLanding();

    await user.click(screen.getByLabelText("Actions for To Delete"));
    await user.click(screen.getByText("Delete"));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(useDashboardStore.getState().dashboards.some((d) => d.id === extraId)).toBe(false);
  });

  describe("search and filter", () => {
    function renderLandingWithUrl(url = "/dashboards") {
      const searchParams = url.includes("?") ? url.slice(url.indexOf("?")) : "";
      return render(
        <MemoryRouter initialEntries={[url]}>
          <NuqsTestingAdapter searchParams={searchParams} hasMemory>
            <DashboardsLandingPage />
            <LocationDisplay />
          </NuqsTestingAdapter>
        </MemoryRouter>,
      );
    }

    it("renders search input and sort control", () => {
      renderLanding();
      expect(screen.getByRole("textbox", { name: /search dashboards/i })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: /sort by/i })).toBeInTheDocument();
    });

    it("filters dashboards by search query matching title", async () => {
      const user = userEvent.setup();
      useDashboardStore.getState().createDashboard("Latency Monitor");
      useDashboardStore.getState().createDashboard("Error Rate");
      renderLanding();

      const search = screen.getByRole("textbox", { name: /search dashboards/i });
      await user.type(search, "Latency");

      expect(screen.getByText("Latency Monitor")).toBeInTheDocument();
      expect(screen.queryByText("Error Rate")).not.toBeInTheDocument();
    });

    it("shows filtered empty state and reset button when query matches nothing", async () => {
      const user = userEvent.setup();
      renderLanding();

      const search = screen.getByRole("textbox", { name: /search dashboards/i });
      await user.type(search, "zzznomatch");

      expect(screen.getByText("No dashboards match your filters")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /reset filters/i }).length).toBeGreaterThan(0);
      expect(screen.queryByText("No dashboards yet")).not.toBeInTheDocument();
    });

    it("resets filters via the Reset filters button in empty state", async () => {
      const user = userEvent.setup();
      renderLanding();

      const title = useDashboardStore.getState().dashboard.title;
      const search = screen.getByRole("textbox", { name: /search dashboards/i });
      await user.type(search, "zzznomatch");

      expect(screen.getByText("No dashboards match your filters")).toBeInTheDocument();
      // Click the first Reset filters button (toolbar button)
      await user.click(screen.getAllByRole("button", { name: /reset filters/i })[0]);

      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.queryByText("No dashboards match your filters")).not.toBeInTheDocument();
    });

    it("shows tag chips in the filter bar when dashboards have tags", () => {
      const id = useDashboardStore.getState().createDashboard("Tagged");
      useDashboardStore.setState((s) => ({
        dashboards: s.dashboards.map((d) =>
          d.id === id ? { ...d, tags: ["prod", "latency"] } : d,
        ),
      }));

      renderLanding();

      // Tags appear in the filter bar (and possibly on the card); at least one instance expected
      expect(screen.getAllByRole("button", { name: /filter by tag prod/i }).length).toBeGreaterThan(
        0,
      );
      expect(
        screen.getAllByRole("button", { name: /filter by tag latency/i }).length,
      ).toBeGreaterThan(0);
    });

    it("filters dashboards by clicking a tag chip in the filter bar", async () => {
      const user = userEvent.setup();
      const id1 = useDashboardStore.getState().createDashboard("Prod Dashboard");
      const id2 = useDashboardStore.getState().createDashboard("Dev Dashboard");
      useDashboardStore.setState((s) => ({
        dashboards: s.dashboards.map((d) => {
          if (d.id === id1) return { ...d, tags: ["prod"] };
          if (d.id === id2) return { ...d, tags: ["dev"] };
          return d;
        }),
      }));

      renderLanding();

      // Click the first "prod" tag chip (in the filter bar)
      await user.click(screen.getAllByRole("button", { name: /filter by tag prod/i })[0]);

      expect(screen.getByText("Prod Dashboard")).toBeInTheDocument();
      expect(screen.queryByText("Dev Dashboard")).not.toBeInTheDocument();
    });

    it("shows Reset filters button in toolbar when a filter is active", async () => {
      const user = userEvent.setup();
      renderLanding();

      const search = screen.getByRole("textbox", { name: /search dashboards/i });
      await user.type(search, "something");

      expect(screen.getAllByRole("button", { name: /reset filters/i }).length).toBeGreaterThan(0);
    });

    it("reads initial filter from URL search params", () => {
      useDashboardStore.getState().createDashboard("Latency Ops");
      useDashboardStore.getState().createDashboard("Error Budget");

      renderLandingWithUrl("/dashboards?q=Latency");

      expect(screen.getByText("Latency Ops")).toBeInTheDocument();
      expect(screen.queryByText("Error Budget")).not.toBeInTheDocument();
    });

    it("reads initial tag filter from URL search params", () => {
      const id = useDashboardStore.getState().createDashboard("Prod SLA");
      useDashboardStore.setState((s) => ({
        dashboards: s.dashboards.map((d) => (d.id === id ? { ...d, tags: ["prod"] } : d)),
      }));
      useDashboardStore.getState().createDashboard("Dev Board");

      renderLandingWithUrl("/dashboards?tags=prod");

      expect(screen.getByText("Prod SLA")).toBeInTheDocument();
      expect(screen.queryByText("Dev Board")).not.toBeInTheDocument();
    });

    it("does not flip archived=false to archived=true when resetting filters", async () => {
      const user = userEvent.setup();
      renderLandingWithUrl("/dashboards?q=nomatch&archived=false");

      await user.click(screen.getAllByRole("button", { name: /reset filters/i })[0]);

      expect(screen.getByTestId("location")).toHaveTextContent("/dashboards");
      expect(screen.getByTestId("location")).not.toHaveTextContent("archived=true");
    });
  });

  describe("favorites", () => {
    it("renders a star button on each dashboard card", () => {
      renderLanding();

      const title = useDashboardStore.getState().dashboard.title;
      expect(
        screen.getByRole("button", { name: new RegExp(`Add ${title} to favorites`, "i") }),
      ).toBeInTheDocument();
    });

    it("toggles favorite state when star button is clicked", async () => {
      const user = userEvent.setup();
      renderLanding();

      const id = useDashboardStore.getState().activeDashboardId;
      const title = useDashboardStore.getState().dashboard.title;

      await user.click(
        screen.getByRole("button", { name: new RegExp(`Add ${title} to favorites`, "i") }),
      );

      expect(
        useDashboardStore.getState().dashboards.find((d) => d.id === id)?.favoritedAt,
      ).toBeTruthy();
    });

    it("shows Favorites filter chip when at least one dashboard is favorited", async () => {
      const user = userEvent.setup();
      renderLanding();

      const title = useDashboardStore.getState().dashboard.title;
      await user.click(
        screen.getByRole("button", { name: new RegExp(`Add ${title} to favorites`, "i") }),
      );

      expect(screen.getByRole("button", { name: /filter by favorites/i })).toBeInTheDocument();
    });

    it("filters to favorites only when Favorites chip is clicked", async () => {
      const user = userEvent.setup();
      useDashboardStore.getState().createDashboard("Second Dashboard");
      const firstId = useDashboardStore.getState().dashboards[0].id;
      useDashboardStore.getState().toggleFavoriteDashboard(firstId);

      renderLanding();

      await user.click(screen.getByRole("button", { name: /filter by favorites/i }));

      expect(
        screen.getByText(useDashboardStore.getState().dashboards[0].title),
      ).toBeInTheDocument();
      expect(screen.queryByText("Second Dashboard")).not.toBeInTheDocument();
    });

    it("ranks favorited dashboards first when sorted by last updated", () => {
      useDashboardStore.getState().createDashboard("Alpha");
      const id2 = useDashboardStore.getState().createDashboard("Beta");
      // Favorite the second-created dashboard
      useDashboardStore.getState().toggleFavoriteDashboard(id2);

      renderLanding();

      const cards = screen.getAllByRole("heading", { level: 6 });
      // Beta is favorited so should appear before Alpha
      const betaIndex = cards.findIndex((el) => el.textContent === "Beta");
      const alphaIndex = cards.findIndex((el) => el.textContent === "Alpha");
      expect(betaIndex).toBeLessThan(alphaIndex);
    });

    it("clears favorites filter via Reset filters button", async () => {
      const user = userEvent.setup();
      const id = useDashboardStore.getState().activeDashboardId;
      useDashboardStore.getState().toggleFavoriteDashboard(id);
      useDashboardStore.getState().createDashboard("Non-favorite");

      render(
        <MemoryRouter initialEntries={["/dashboards?favorites=true"]}>
          <NuqsTestingAdapter searchParams="?favorites=true" hasMemory>
            <DashboardsLandingPage />
            <LocationDisplay />
          </NuqsTestingAdapter>
        </MemoryRouter>,
      );

      // Only the favorite dashboard is visible
      expect(screen.queryByText("Non-favorite")).not.toBeInTheDocument();

      await user.click(screen.getAllByRole("button", { name: /reset filters/i })[0]);

      // Non-favorite is now visible again
      expect(screen.getByText("Non-favorite")).toBeInTheDocument();
    });
  });
});
