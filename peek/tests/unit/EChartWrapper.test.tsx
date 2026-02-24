import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import * as echarts from "echarts/core";

import EChartWrapper from "../../src/components/visualizations/EChartWrapper";

// Capture the onResize callback passed to useResizeObserver so tests can trigger it.
let capturedOnResize: (() => void) | undefined;

vi.mock("use-resize-observer", () => ({
  default: ({ onResize }: { onResize?: () => void } = {}) => {
    capturedOnResize = onResize;
    return {};
  },
}));

function getLastMockInstance() {
  const mockInit = echarts.init as ReturnType<typeof vi.fn>;
  return mockInit.mock.results.at(-1)?.value as {
    resize: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };
}

describe("EChartWrapper", () => {
  beforeEach(() => {
    (echarts.init as ReturnType<typeof vi.fn>).mockClear();
    capturedOnResize = undefined;
  });

  it("calls chart.resize() when the container size changes", () => {
    render(<EChartWrapper option={{}} />);
    const instance = getLastMockInstance();

    expect(capturedOnResize).toBeDefined();
    capturedOnResize?.();

    expect(instance.resize).toHaveBeenCalledOnce();
  });

  it("disposes the chart instance on unmount", () => {
    const { unmount } = render(<EChartWrapper option={{}} />);
    const instance = getLastMockInstance();

    unmount();

    expect(instance.dispose).toHaveBeenCalledOnce();
  });
});
