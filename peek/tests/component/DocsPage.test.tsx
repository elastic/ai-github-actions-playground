import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import { resetAllStores } from "../fixtures/test-utils";

// Use IDs that exist in DocsNavSidebar NAV_GROUPS so sidebar renders them
const TEST_SECTIONS = [
  { id: "about", title: "About Peek", body: ["About body content."] },
  { id: "connecting", title: "Connecting", body: ["Connecting body content."] },
  { id: "cors", title: "CORS Setup", body: ["CORS body content."] },
];

vi.mock("../../src/docs/sections", () => ({
  default: [
    { id: "about", title: "About Peek", body: ["About body content."] },
    { id: "connecting", title: "Connecting", body: ["Connecting body content."] },
    { id: "cors", title: "CORS Setup", body: ["CORS body content."] },
  ],
}));

// Capture IntersectionObserver instances so we can trigger callbacks in tests
let observerCallback: IntersectionObserverCallback;
let observerInstance: {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  resetAllStores();
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn((callback: IntersectionObserverCallback) => {
      observerCallback = callback;
      observerInstance = {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
      return observerInstance;
    }),
  );
  // scrollIntoView is not available in happy-dom
  Element.prototype.scrollIntoView = vi.fn();
});

// Lazy import so mocks are registered before the module loads
const { default: DocsPage } = await import("../../src/components/DocsPage");

function renderDocsPage(initialSection?: string) {
  const searchParams: Record<string, string> = {};
  if (initialSection) searchParams.section = initialSection;

  return render(
    <NuqsTestingAdapter searchParams={searchParams}>
      <DocsPage />
    </NuqsTestingAdapter>,
  );
}

/**
 * Helper to build a minimal IntersectionObserverEntry for a given element.
 * @param top - Simulated boundingClientRect.top value (viewport-relative pixels).
 *   Used to determine which entry is "topmost" when multiple sections intersect.
 */
function makeEntry(element: Element, isIntersecting: boolean, top = 0): IntersectionObserverEntry {
  const rect = {
    top,
    bottom: top + 100,
    left: 0,
    right: 100,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRectReadOnly;
  return {
    target: element,
    isIntersecting,
    boundingClientRect: rect,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: isIntersecting ? rect : ({ ...rect, width: 0, height: 0 } as DOMRectReadOnly),
    rootBounds: null,
    time: Date.now(),
  };
}

describe("DocsPage scroll-synced active section", () => {
  it("renders all test sections in the sidebar", () => {
    renderDocsPage();

    for (const section of TEST_SECTIONS) {
      expect(screen.getAllByText(section.title).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("highlights the first section by default when no URL param is set", () => {
    renderDocsPage();

    // First section should be active (variant="contained" -> aria-current="location")
    const activeButtons = screen.getAllByRole("button", { current: "location" });
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0]).toHaveTextContent("About Peek");
  });

  it("updates active section when IntersectionObserver reports a new section visible", async () => {
    renderDocsPage();

    // Verify IntersectionObserver was created
    expect(IntersectionObserver).toHaveBeenCalled();
    expect(observerInstance.observe).toHaveBeenCalled();

    // Simulate scrolling: "connecting" section becomes visible
    const connectingEl = document.getElementById("connecting")!;
    expect(connectingEl).toBeTruthy();

    act(() => {
      observerCallback(
        [makeEntry(connectingEl, true, 10)],
        observerInstance as unknown as IntersectionObserver,
      );
    });

    // The sidebar should now highlight "Connecting"
    const activeButtons = screen.getAllByRole("button", { current: "location" });
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0]).toHaveTextContent("Connecting");
  });

  it("picks the topmost visible section when multiple are intersecting", async () => {
    renderDocsPage();

    const connectingEl = document.getElementById("connecting")!;
    const corsEl = document.getElementById("cors")!;

    act(() => {
      observerCallback(
        [makeEntry(corsEl, true, 200), makeEntry(connectingEl, true, 50)],
        observerInstance as unknown as IntersectionObserver,
      );
    });

    const activeButtons = screen.getAllByRole("button", { current: "location" });
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0]).toHaveTextContent("Connecting");
  });

  it("clicking a sidebar item still jumps to the section", async () => {
    const user = userEvent.setup();
    renderDocsPage();

    // Click on "CORS Setup" in the sidebar
    const corsButtons = screen.getAllByText("CORS Setup");
    // The sidebar button (not the heading)
    const sidebarButton = corsButtons.find((el) => el.closest("button") !== null)!;
    await user.click(sidebarButton.closest("button")!);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("ignores non-intersecting entries", () => {
    renderDocsPage();

    const connectingEl = document.getElementById("connecting")!;

    act(() => {
      observerCallback(
        [makeEntry(connectingEl, false, 10)],
        observerInstance as unknown as IntersectionObserver,
      );
    });

    // Active section should still be "about" (the default)
    const activeButtons = screen.getAllByRole("button", { current: "location" });
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0]).toHaveTextContent("About Peek");
  });
});
