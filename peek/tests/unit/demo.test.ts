import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchDemoConfig } from "../../src/services/demo";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchDemoConfig", () => {
  it("returns null when the server responds with 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 })),
    );

    const result = await fetchDemoConfig("https://example.com/app/");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await fetchDemoConfig("https://example.com/app/");
    expect(result).toBeNull();
  });

  it("returns null when the JSON is malformed or missing required fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: "https://demo.es.io" }), { status: 200 }),
      ),
    );

    const result = await fetchDemoConfig("https://example.com/app/");
    expect(result).toBeNull();
  });

  it("returns null when any required field is an empty string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ url: "https://demo.es.io", username: "", password: "pw" }),
          { status: 200 },
        ),
      ),
    );

    const result = await fetchDemoConfig("https://example.com/app/");
    expect(result).toBeNull();
  });

  it("returns a valid DemoConfig when all required fields are present", async () => {
    const config = {
      url: "https://demo.es.io:443",
      username: "demo-user",
      password: "demo-pass",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(config), { status: 200 })),
    );

    const result = await fetchDemoConfig("https://example.com/app/");
    expect(result).toEqual(config);
  });

  it("builds the correct URL from the base URL", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("Not Found", { status: 404 }));
    vi.stubGlobal("fetch", fetchSpy);

    await fetchDemoConfig("https://example.com/myapp/");

    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/myapp/demo.json");
  });

  it("handles base URL without trailing slash", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("Not Found", { status: 404 }));
    vi.stubGlobal("fetch", fetchSpy);

    await fetchDemoConfig("https://example.com/myapp");

    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/myapp/demo.json");
  });
});
