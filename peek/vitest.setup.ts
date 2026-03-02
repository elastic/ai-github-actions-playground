import { vi, afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

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

vi.stubGlobal("localStorage", new StorageMock());
vi.stubGlobal("sessionStorage", new StorageMock());

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
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
