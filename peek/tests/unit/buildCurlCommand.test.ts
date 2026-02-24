import { describe, it, expect } from "vitest";

import { buildCurlCommand } from "../../src/utils/buildCurlCommand";
import type { ElasticsearchConnection } from "../../src/services/es";

const BASE_URL = "https://my-cluster.es.io:9243";

function makeConnection(overrides: Partial<ElasticsearchConnection> = {}): ElasticsearchConnection {
  return { url: BASE_URL, ...overrides };
}

describe("buildCurlCommand", () => {
  it("produces a basic GET command without auth", () => {
    const cmd = buildCurlCommand(makeConnection(), "GET", "/", "");
    expect(cmd).toBe(`curl -X GET '${BASE_URL}/' \\\n  -H 'Content-Type: application/json'`);
  });

  it("includes ApiKey authorization header when apiKey is set", () => {
    const cmd = buildCurlCommand(makeConnection({ apiKey: "my-key" }), "GET", "/_cat/indices", "");
    expect(cmd).toContain(`-H 'Authorization: ApiKey my-key'`);
  });

  it("includes basic auth -u flag when username and password are set", () => {
    const cmd = buildCurlCommand(
      makeConnection({ username: "elastic", password: "changeme" }),
      "GET",
      "/",
      "",
    );
    expect(cmd).toContain(`-u 'elastic:changeme'`);
    expect(cmd).not.toContain("Authorization");
  });

  it("prefers apiKey over username/password when both are present", () => {
    const cmd = buildCurlCommand(
      makeConnection({ apiKey: "key", username: "elastic", password: "changeme" }),
      "GET",
      "/",
      "",
    );
    expect(cmd).toContain(`-H 'Authorization: ApiKey key'`);
    expect(cmd).not.toContain(`-u`);
  });

  it("appends request body with -d flag when body is non-empty", () => {
    const body = '{"query":{"match_all":{}}}';
    const cmd = buildCurlCommand(makeConnection(), "POST", "/_search", body);
    expect(cmd).toContain(`-d '${body}'`);
  });

  it("omits -d flag when body is empty", () => {
    const cmd = buildCurlCommand(makeConnection(), "GET", "/_cat/health", "");
    expect(cmd).not.toContain("-d");
  });

  it("omits -d flag when body is whitespace only", () => {
    const cmd = buildCurlCommand(makeConnection(), "GET", "/", "   ");
    expect(cmd).not.toContain("-d");
  });

  it("normalizes a path without a leading slash", () => {
    const cmd = buildCurlCommand(makeConnection(), "GET", "_cat/indices?v", "");
    expect(cmd).toContain(`'${BASE_URL}/_cat/indices?v'`);
  });

  it("strips trailing slashes from the base URL", () => {
    const cmd = buildCurlCommand({ url: `${BASE_URL}///` }, "GET", "/", "");
    expect(cmd).toContain(`'${BASE_URL}/'`);
    expect(cmd).not.toContain("///");
  });

  it("uses proxy URL and includes proxy headers when configured", () => {
    const cmd = buildCurlCommand(
      makeConnection({
        proxyUrl: "http://localhost:3000/_es/",
        proxyHost: "https://cluster.example:443",
        proxyApiKey: "proxy-key",
      }),
      "GET",
      "/",
      "",
    );
    expect(cmd).toContain(`'http://localhost:3000/_es/'`);
    expect(cmd).toContain(`-H 'X-Elastic-Peek-Proxy-Host: https://cluster.example:443'`);
    expect(cmd).toContain(`-H 'X-Elastic-Peek-Proxy-Api-Key: proxy-key'`);
  });

  it("escapes single quotes in the body to keep the shell command valid", () => {
    const body = `{"query":"it's a test"}`;
    const cmd = buildCurlCommand(makeConnection(), "POST", "/_search", body);
    expect(cmd).toContain(`-d '{"query":"it'\\''s a test"}'`);
  });

  it("escapes single quotes in the API key", () => {
    const cmd = buildCurlCommand(makeConnection({ apiKey: "key'with'quotes" }), "GET", "/", "");
    expect(cmd).toContain(`ApiKey key'\\''with'\\''quotes`);
  });

  it("escapes single quotes in username and password", () => {
    const cmd = buildCurlCommand(
      makeConnection({ username: "user'name", password: "pass'word" }),
      "GET",
      "/",
      "",
    );
    expect(cmd).toContain(`-u 'user'\\''name:pass'\\''word'`);
  });

  it("uses multiline format joining parts with backslash-newline", () => {
    const cmd = buildCurlCommand(makeConnection({ apiKey: "k" }), "GET", "/", "");
    expect(cmd).toContain("\\\n  ");
  });
});
