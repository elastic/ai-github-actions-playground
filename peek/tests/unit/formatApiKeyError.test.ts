import { describe, expect, it } from "vitest";

import { formatApiKeyError } from "../../src/components/addData/CollectorCredentials";

describe("formatApiKeyError", () => {
  it("silences api_key + unauthorized errors", () => {
    expect(formatApiKeyError("api_key action unauthorized")).toBe("");
  });

  it("silences api key + forbidden errors", () => {
    expect(formatApiKeyError("api key forbidden")).toBe("");
  });

  it("silences api_key + access denied errors", () => {
    expect(formatApiKeyError("api_key access denied")).toBe("");
  });

  it("returns auth message for authentication failures", () => {
    expect(formatApiKeyError("authentication required")).toBe(
      "Authentication failed. Check your Elasticsearch connection credentials.",
    );
  });

  it("returns auth message for 401 errors", () => {
    expect(formatApiKeyError("401 Unauthorized")).toBe(
      "Authentication failed. Check your Elasticsearch connection credentials.",
    );
  });

  it("returns security message for Bad Request", () => {
    expect(formatApiKeyError("Bad Request")).toBe(
      "Security features may not be enabled on this cluster. Provide an API key manually.",
    );
  });

  it("returns security message for disabled security", () => {
    expect(
      formatApiKeyError("action [cluster:admin/xpack/security/api_key/create] is disabled"),
    ).toBe("Security features may not be enabled on this cluster. Provide an API key manually.");
  });

  it("returns security message for security not enabled", () => {
    expect(formatApiKeyError("security is not enabled")).toBe(
      "Security features may not be enabled on this cluster. Provide an API key manually.",
    );
  });

  it("returns security message for security_exception type", () => {
    expect(formatApiKeyError("security_exception: unable to create api key")).toBe(
      "Security features may not be enabled on this cluster. Provide an API key manually.",
    );
  });

  it("returns raw message for unknown errors", () => {
    expect(formatApiKeyError("connection timeout")).toBe("connection timeout");
  });
});
