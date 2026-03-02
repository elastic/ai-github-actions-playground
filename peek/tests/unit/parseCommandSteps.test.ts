import { describe, it, expect } from "vitest";

import { parseCommandSteps } from "../../src/utils/addDataUtils";

describe("parseCommandSteps", () => {
  it("returns an empty array when there are no step markers", () => {
    expect(parseCommandSteps("echo hello")).toEqual([]);
    expect(parseCommandSteps("")).toEqual([]);
  });

  it("parses a single step", () => {
    const steps = parseCommandSteps("# 1. Install\nhelm install foo");
    expect(steps).toEqual([{ number: 1, title: "Install", command: "helm install foo" }]);
  });

  it("parses multiple steps", () => {
    const command = [
      "# 1. Download",
      "curl -L -O https://example.com/file.tar.gz",
      "",
      "# 2. Set credentials",
      'export FOO="bar"',
      "",
      "# 3. Start",
      "sudo ./start",
    ].join("\n");

    const steps = parseCommandSteps(command);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({
      number: 1,
      title: "Download",
      command: "curl -L -O https://example.com/file.tar.gz",
    });
    expect(steps[1]).toEqual({
      number: 2,
      title: "Set credentials",
      command: 'export FOO="bar"',
    });
    expect(steps[2]).toEqual({
      number: 3,
      title: "Start",
      command: "sudo ./start",
    });
  });

  it("prepends preamble lines to the first step", () => {
    const command = ["# Note: This is a preamble", "", "# 1. Install", "helm install foo"].join(
      "\n",
    );

    const steps = parseCommandSteps(command);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.command).toBe("# Note: This is a preamble\nhelm install foo");
  });

  it("handles multi-line commands within a step", () => {
    const command = [
      "# 1. Create config",
      "cat > .env << 'DOTENV'",
      "FOO=bar",
      "BAZ=qux",
      "DOTENV",
      "",
      "# 2. Run",
      "docker compose up -d",
    ].join("\n");

    const steps = parseCommandSteps(command);
    expect(steps).toHaveLength(2);
    expect(steps[0]!.command).toContain("cat > .env");
    expect(steps[0]!.command).toContain("DOTENV");
    expect(steps[1]!.command).toBe("docker compose up -d");
  });
});
