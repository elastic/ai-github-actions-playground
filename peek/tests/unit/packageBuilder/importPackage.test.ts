import { describe, it, expect } from "vitest";
import { importFromFileMap } from "../../../src/services/packageBuilder/importPackage";
import { APACHE_MANIFEST, APACHE_TEMPLATE, APACHE_README } from "./fixtures/apache";
import { REDIS_MANIFEST, REDIS_TEMPLATE } from "./fixtures/redis";

const encoder = new TextEncoder();

function makeFileMap(files: Record<string, string>, rootFolder = "package"): Map<string, Uint8Array> {
  const map = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(files)) {
    map.set(`${rootFolder}/${path}`, encoder.encode(content));
  }
  return map;
}

describe("importFromFileMap — Apache input package", () => {
  it("parses identity fields from manifest", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": APACHE_MANIFEST,
      "agent/input/input.yml.hbs": APACHE_TEMPLATE,
      "docs/README.md": APACHE_README,
    }, "apache_input_otel");

    const { data, warnings } = await importFromFileMap(fileMap);

    expect(data.identity.name).toBe("apache");
    expect(data.identity.title).toBe("Apache HTTP Server OpenTelemetry Input Package");
    expect(data.identity.version).toBe("0.1.0");
    expect(data.identity.formatVersion).toBe("3.5.0");
    expect(data.identity.ownerGithub).toBe("elastic/ecosystem");
    expect(data.identity.ownerType).toBe("elastic");
    expect(data.identity.kibanaVersion).toBe("^9.2.0");
    expect(data.identity.subscription).toBe("basic");
    expect(data.identity.categories).toEqual(["web", "observability", "opentelemetry"]);
    expect(data.identity.description).toBe("Collect Apache HTTP Server status metrics using OpenTelemetry Collector");
    // Icon file not included → warning
    expect(warnings).toContainEqual(expect.stringContaining("logo_apache_otel.svg"));
  });

  it("parses policy template", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": APACHE_MANIFEST,
      "agent/input/input.yml.hbs": APACHE_TEMPLATE,
    }, "apache_input_otel");

    const { data } = await importFromFileMap(fileMap);

    expect(data.policyTemplate.name).toBe("apachereceiver");
    expect(data.policyTemplate.title).toBe("Apache HTTP Server Metrics (OpenTelemetry)");
    expect(data.policyTemplate.description).toBe("Collect Apache HTTP Server status metrics using OpenTelemetry Collector");
    expect(data.policyTemplate.signalTypes).toEqual(["metrics"]);
    expect(data.policyTemplate.dynamicSignalTypes).toBe(false);
  });

  it("parses all 11 variables with correct types and defaults", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": APACHE_MANIFEST,
      "agent/input/input.yml.hbs": APACHE_TEMPLATE,
    }, "apache_input_otel");

    const { data } = await importFromFileMap(fileMap);
    const vars = data.variables;

    expect(vars).toHaveLength(11);

    // endpoint
    const endpoint = vars.find((v) => v.name === "endpoint")!;
    expect(endpoint.type).toBe("text");
    expect(endpoint.required).toBe(true);
    expect(endpoint.default).toBe("http://localhost:8080/server-status?auto");
    expect(endpoint.showUser).toBe(true);
    expect(endpoint.title).toBe("Endpoint");
    expect(endpoint.description).toBe("The URL of the Apache server-status endpoint.");

    // collection_interval
    const interval = vars.find((v) => v.name === "collection_interval")!;
    expect(interval.type).toBe("duration");
    expect(interval.default).toBe("10s");
    expect(interval.showUser).toBe(false);

    // initial_delay
    const delay = vars.find((v) => v.name === "initial_delay")!;
    expect(delay.type).toBe("duration");
    expect(delay.default).toBe("1s");

    // timeout
    const timeout = vars.find((v) => v.name === "timeout")!;
    expect(timeout.type).toBe("duration");
    expect(timeout.default).toBe("10s");

    // tls_enabled (bool with false default)
    const tlsEnabled = vars.find((v) => v.name === "tls_enabled")!;
    expect(tlsEnabled.type).toBe("bool");
    expect(tlsEnabled.default).toBe("false");
    expect(tlsEnabled.showUser).toBe(true);

    // tls_ca_file (no default)
    const caFile = vars.find((v) => v.name === "tls_ca_file")!;
    expect(caFile.type).toBe("text");
    expect(caFile.default).toBe("");
    expect(caFile.required).toBe(false);
  });

  it("loads template content verbatim", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": APACHE_MANIFEST,
      "agent/input/input.yml.hbs": APACHE_TEMPLATE,
    }, "apache_input_otel");

    const { data } = await importFromFileMap(fileMap);
    expect(data.templateContent).toBe(APACHE_TEMPLATE);
  });

  it("loads README content", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": APACHE_MANIFEST,
      "agent/input/input.yml.hbs": APACHE_TEMPLATE,
      "docs/README.md": APACHE_README,
    }, "apache_input_otel");

    const { data } = await importFromFileMap(fileMap);
    expect(data.readmeContent).toBe(APACHE_README);
  });
});

describe("importFromFileMap — Redis input package", () => {
  it("parses identity and strips _input_otel suffix from name", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": REDIS_MANIFEST,
      "agent/input/input.yml.hbs": REDIS_TEMPLATE,
    }, "redis_input_otel");

    const { data } = await importFromFileMap(fileMap);
    expect(data.identity.name).toBe("redis");
    expect(data.identity.title).toBe("Redis OpenTelemetry Input Package");
    expect(data.identity.categories).toEqual(["datastore", "observability", "opentelemetry"]);
  });

  it("parses select-type variables with options", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": REDIS_MANIFEST,
      "agent/input/input.yml.hbs": REDIS_TEMPLATE,
    }, "redis_input_otel");

    const { data } = await importFromFileMap(fileMap);

    const transport = data.variables.find((v) => v.name === "transport")!;
    expect(transport.type).toBe("select");
    expect(transport.default).toBe("tcp");
    expect(transport.multi).toBe(false);
    expect(transport.options).toEqual([
      { text: "TCP", value: "tcp" },
      { text: "Unix Socket", value: "unix" },
    ]);

    const tlsMin = data.variables.find((v) => v.name === "tls_min_version")!;
    expect(tlsMin.type).toBe("select");
    expect(tlsMin.options).toHaveLength(4);
    expect(tlsMin.options[0]).toEqual({ text: "1.0", value: "1.0" });
  });

  it("parses password-type variables", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": REDIS_MANIFEST,
      "agent/input/input.yml.hbs": REDIS_TEMPLATE,
    }, "redis_input_otel");

    const { data } = await importFromFileMap(fileMap);
    const password = data.variables.find((v) => v.name === "password")!;
    expect(password.type).toBe("password");
    expect(password.secret).toBe(false);
  });

  it("parses all 16 Redis variables", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": REDIS_MANIFEST,
      "agent/input/input.yml.hbs": REDIS_TEMPLATE,
    }, "redis_input_otel");

    const { data } = await importFromFileMap(fileMap);
    expect(data.variables).toHaveLength(16);

    // Verify all variable names are present
    const names = data.variables.map((v) => v.name);
    expect(names).toContain("endpoint");
    expect(names).toContain("username");
    expect(names).toContain("password");
    expect(names).toContain("transport");
    expect(names).toContain("dialer_timeout");
    expect(names).toContain("tls_insecure");
    expect(names).toContain("tls_insecure_skip_verify");
    expect(names).toContain("tls_ca_file");
    expect(names).toContain("tls_cert_file");
    expect(names).toContain("tls_key_file");
    expect(names).toContain("tls_server_name_override");
    expect(names).toContain("tls_min_version");
    expect(names).toContain("tls_max_version");
    expect(names).toContain("tls_include_system_ca_certs_pool");
    expect(names).toContain("collection_interval");
    expect(names).toContain("initial_delay");
  });

  it("loads Redis template content verbatim", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": REDIS_MANIFEST,
      "agent/input/input.yml.hbs": REDIS_TEMPLATE,
    }, "redis_input_otel");

    const { data } = await importFromFileMap(fileMap);
    expect(data.templateContent).toBe(REDIS_TEMPLATE);
  });
});

describe("importFromFileMap — error handling", () => {
  it("throws when no manifest.yml is found", async () => {
    const fileMap = makeFileMap({ "README.md": "hello" });
    await expect(importFromFileMap(fileMap)).rejects.toThrow("No manifest.yml found");
  });

  it("warns when template is missing", async () => {
    const fileMap = makeFileMap({ "manifest.yml": APACHE_MANIFEST });
    const { warnings } = await importFromFileMap(fileMap);
    expect(warnings).toContainEqual(expect.stringContaining("input.yml.hbs"));
  });

  it("warns when README is missing", async () => {
    const fileMap = makeFileMap({
      "manifest.yml": APACHE_MANIFEST,
      "agent/input/input.yml.hbs": APACHE_TEMPLATE,
    });
    const { warnings } = await importFromFileMap(fileMap);
    expect(warnings).toContainEqual(expect.stringContaining("README.md"));
  });

  it("handles minimal manifest gracefully", async () => {
    const minimalManifest = `
format_version: 3.5.0
name: minimal_input_otel
title: Minimal
version: 0.1.0
type: input
policy_templates: []
owner:
  github: test/team
  type: community
`;
    const fileMap = makeFileMap({ "manifest.yml": minimalManifest });
    const { data } = await importFromFileMap(fileMap);
    expect(data.identity.name).toBe("minimal");
    expect(data.identity.ownerType).toBe("community");
    expect(data.variables).toEqual([]);
  });

  it("handles manifest with no policy_templates gracefully", async () => {
    const noTemplates = `
format_version: 3.5.0
name: empty_input_otel
title: Empty
version: 0.1.0
type: input
owner:
  github: test/team
  type: elastic
`;
    const fileMap = makeFileMap({ "manifest.yml": noTemplates });
    const { data } = await importFromFileMap(fileMap);
    expect(data.identity.name).toBe("empty");
    expect(data.policyTemplate.name).toBe("");
    expect(data.variables).toEqual([]);
  });
});
