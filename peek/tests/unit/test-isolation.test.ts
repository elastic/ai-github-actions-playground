/**
 * Guard test: ensure test-utils does NOT statically depend on storeResetters.
 *
 * The `resetAllStores` helper in test-utils must import from `resetRegistry`
 * (a tiny file with no store imports) rather than `storeResetters` (which
 * imports every store).  Importing storeResetters causes vitest's `--related`
 * and `--changed` flags to mark every component test as "related" to any
 * store file change, defeating diff-based test selection.
 *
 * If this test fails, someone re-introduced a static import of storeResetters
 * in test-utils.  Fix by importing from `resetRegistry` instead.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("test isolation", () => {
  it("test-utils must not import storeResetters (use resetRegistry instead)", () => {
    const source = readFileSync(resolve(__dirname, "../fixtures/test-utils.ts"), "utf-8");
    expect(source).not.toMatch(/from\s+["'].*storeResetters["']/);
  });

  it("test-utils must import from resetRegistry", () => {
    const source = readFileSync(resolve(__dirname, "../fixtures/test-utils.ts"), "utf-8");
    expect(source).toMatch(/from\s+["'].*resetRegistry["']/);
  });
});
