import { describe, it, expect } from "vitest";
import { parseDocSection } from "../../src/docs/sections";

describe("parseDocSection", () => {
  it("extracts the title from the first H1 heading", () => {
    const raw = "# My Section\n\nSome content here.\n";
    const section = parseDocSection("my-section", raw);
    expect(section.title).toBe("My Section");
  });

  it("uses the id as the title when no H1 heading is present", () => {
    const raw = "Some content with no heading.\n";
    const section = parseDocSection("fallback-id", raw);
    expect(section.title).toBe("fallback-id");
  });

  it("splits body into paragraphs on blank lines", () => {
    const raw = "# Title\n\nFirst paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n";
    const section = parseDocSection("test", raw);
    expect(section.body).toEqual(["First paragraph.", "Second paragraph.", "Third paragraph."]);
  });

  it("filters out empty paragraphs", () => {
    const raw = "# Title\n\n\n\nOnly paragraph.\n\n\n";
    const section = parseDocSection("test", raw);
    expect(section.body).toEqual(["Only paragraph."]);
  });

  it("sets the id to the value provided", () => {
    const raw = "# Title\n\nBody text.\n";
    const section = parseDocSection("my-id", raw);
    expect(section.id).toBe("my-id");
  });

  it("does not set image (image is undefined)", () => {
    const raw = "# Title\n\nBody text.\n";
    const section = parseDocSection("test", raw);
    expect(section.image).toBeUndefined();
  });

  it("unescapes Markdown escape sequences in body paragraphs", () => {
    const raw = "# Title\n\nTalks to Elasticsearch via the \\_query REST API.\n";
    const section = parseDocSection("test", raw);
    expect(section.body[0]).toBe("Talks to Elasticsearch via the _query REST API.");
  });
});
