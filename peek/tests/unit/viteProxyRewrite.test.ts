import { describe, it, expect } from "vitest";

import { rewriteEsProxyPath } from "../../src/utils/rewriteEsProxyPath";

describe("rewriteEsProxyPath", () => {
  it("rewrites /_es root requests", () => {
    expect(rewriteEsProxyPath("/_es")).toBe("/");
  });

  it("rewrites /_es root requests with query strings", () => {
    expect(rewriteEsProxyPath("/_es?pretty=true")).toBe("/?pretty=true");
  });

  it("rewrites nested /_es API paths", () => {
    expect(rewriteEsProxyPath("/_es/_cluster/health?pretty=true")).toBe(
      "/_cluster/health?pretty=true",
    );
  });
});
