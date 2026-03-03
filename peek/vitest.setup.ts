import React from "react";
import { vi, afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

vi.mock("@testing-library/react", async () => {
  const actual = await vi.importActual("@testing-library/react");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");

  return {
    ...actual,
    render: (ui: React.ReactNode, options?: { [key: string]: unknown }) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      return (actual as { render: (...args: unknown[]) => unknown }).render(
        React.createElement(QueryClientProvider, { client: queryClient }, ui),
        options,
      );
    },
  };
});

class StorageMock implements Storage {
  private store: Record<string, string> = {};
  get length() {
    return Object.keys(this.store).length;
  }
  clear() {
    this.store = {};
  }
  getItem(key: string) {
    return Object.hasOwn(this.store, key) ? this.store[key]! : null;
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
}

const localStorageMock = new StorageMock();
const sessionStorageMock = new StorageMock();
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", sessionStorageMock);

afterEach(() => {
  cleanup();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

vi.mock("echarts/core", () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getWidth: vi.fn(() => 500),
    getHeight: vi.fn(() => 300),
    getDataURL: vi.fn(() => "data:image/png;base64,mock"),
  })),
  use: vi.fn(),
  connect: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
);
