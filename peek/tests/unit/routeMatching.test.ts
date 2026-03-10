import { describe, expect, it } from "vitest";

import { getMatchedPageId } from "../../src/features/easterEgg/routeMatching";

describe("route matching for easter egg progress", () => {
  it("prefers concrete hosts routes over parameterized host detail routes", () => {
    expect(getMatchedPageId("/hosts/linux")).toBe("hostsLinux");
    expect(getMatchedPageId("/hosts/windows")).toBe("hostsWindows");
  });

  it("matches parameterized host detail routes when no concrete route matches", () => {
    expect(getMatchedPageId("/hosts/i-12345")).toBe("hostDetail");
  });
});
