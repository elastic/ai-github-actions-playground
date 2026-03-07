import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  findUndefinedVars,
  findUnusedVars,
} from "../../../src/services/packageBuilder/renderTemplate";
import type { PackageVariable } from "../../../src/types/packageBuilder";
import { APACHE_TEMPLATE } from "./fixtures/apache";
import { REDIS_TEMPLATE } from "./fixtures/redis";

const makeVar = (
  name: string,
  type: PackageVariable["type"] = "text",
  defaultVal = "",
): PackageVariable => ({
  name,
  type,
  title: name,
  description: "",
  default: defaultVal,
  required: false,
  showUser: true,
  multi: false,
  secret: false,
  options: [],
});

describe("renderTemplate", () => {
  it("renders a simple template with variable substitution", () => {
    const result = renderTemplate(
      "receivers:\n  redis:\n    endpoint: {{endpoint}}",
      [makeVar("endpoint", "text", "localhost:6379")],
      {},
    );
    expect(result.templateError).toBeNull();
    expect(result.rendered).toContain("endpoint: localhost:6379");
    expect(result.yamlValid).toBe(true);
  });

  it("uses mock overrides over defaults", () => {
    const result = renderTemplate(
      "endpoint: {{endpoint}}",
      [makeVar("endpoint", "text", "localhost:6379")],
      { endpoint: "redis.prod:6379" },
    );
    expect(result.rendered).toContain("redis.prod:6379");
  });

  it("renders bool variables as boolean values", () => {
    const result = renderTemplate(
      "insecure: {{tls_insecure}}",
      [makeVar("tls_insecure", "bool", "true")],
      {},
    );
    expect(result.rendered).toContain("insecure: true");
  });

  it("renders integer variables as numbers", () => {
    const result = renderTemplate("port: {{port}}", [makeVar("port", "integer", "6379")], {});
    expect(result.rendered).toContain("port: 6379");
  });

  it("handles {{#if}} blocks — true case", () => {
    const result = renderTemplate(
      "{{#if tls_enabled}}\ntls: true\n{{/if}}",
      [makeVar("tls_enabled", "bool", "true")],
      {},
    );
    expect(result.rendered).toContain("tls: true");
  });

  it("handles {{#if}} blocks — false case", () => {
    const result = renderTemplate(
      "{{#if tls_enabled}}\ntls: true\n{{/if}}",
      [makeVar("tls_enabled", "bool", "false")],
      {},
    );
    expect(result.rendered).not.toContain("tls: true");
  });

  it("reports template compilation errors", () => {
    const result = renderTemplate("{{#if}}broken{{/if}}", [], {});
    expect(result.templateError).toBeTruthy();
  });

  it("auto-indents multi-line variable values to match YAML context", () => {
    const template = "receivers:\n  myreceiver:\n    config: {{config_value}}";
    const result = renderTemplate(
      template,
      [makeVar("config_value", "text", "line1\nline2\nline3")],
      {},
    );
    expect(result.templateError).toBeNull();
    // Continuation lines should be indented to column 12 (where "config: " value starts)
    expect(result.rendered).toContain("    config: line1\n            line2\n            line3");
    expect(result.yamlValid).toBe(true);
  });

  it("re-indents multiline values at the actual substitution site", () => {
    const template = ["literal: line1", "  line2", "rendered:", "  value: {{config_value}}"].join(
      "\n",
    );
    const result = renderTemplate(template, [makeVar("config_value", "text", "line1\nline2")], {});
    expect(result.templateError).toBeNull();
    expect(result.rendered).toContain("literal: line1\n  line2");
    expect(result.rendered).toContain("  value: line1\n         line2");
  });

  it("collapses excessive blank lines from false {{#if}} blocks", () => {
    const template = "top: val\n{{#if flag}}\nconditional: yes\n{{/if}}\nbottom: val";
    const result = renderTemplate(template, [makeVar("flag", "bool", "false")], {});
    expect(result.templateError).toBeNull();
    // Should not have 3+ consecutive newlines
    expect(result.rendered).not.toMatch(/\n{3,}/);
    expect(result.rendered).toContain("top: val");
    expect(result.rendered).toContain("bottom: val");
  });

  it("detects invalid YAML in rendered output", () => {
    const result = renderTemplate("key: [{{value}}", [makeVar("value", "text", "test")], {});
    expect(result.yamlValid).toBe(false);
    expect(result.yamlError).toBeTruthy();
  });

  it("renders the real Apache template with defaults to valid YAML", () => {
    const vars = [
      makeVar("endpoint", "text", "http://localhost:8080/server-status?auto"),
      makeVar("collection_interval", "text", "10s"),
      makeVar("initial_delay", "text", "1s"),
      makeVar("timeout", "text", "10s"),
      makeVar("tls_enabled", "bool", "false"),
      makeVar("tls_insecure", "bool", "false"),
      makeVar("tls_insecure_skip_verify", "bool", "false"),
      makeVar("tls_ca_file", "text", ""),
      makeVar("tls_cert_file", "text", ""),
      makeVar("tls_key_file", "text", ""),
      makeVar("tls_server_name_override", "text", ""),
    ];
    const result = renderTemplate(APACHE_TEMPLATE, vars, {});
    expect(result.templateError).toBeNull();
    expect(result.yamlValid).toBe(true);
    expect(result.rendered).toContain("endpoint: http://localhost:8080/server-status?auto");
    expect(result.rendered).toContain("receivers:");
    expect(result.rendered).toContain("processors:");
    // TLS block should NOT appear (tls_enabled is false)
    expect(result.rendered).not.toContain("tls:");
  });

  it("renders the real Apache template with TLS enabled", () => {
    const vars = [
      makeVar("endpoint", "text", "https://apache.local/server-status?auto"),
      makeVar("collection_interval", "text", "10s"),
      makeVar("initial_delay", "text", "1s"),
      makeVar("timeout", "text", "10s"),
      makeVar("tls_enabled", "bool", "true"),
      makeVar("tls_insecure", "bool", "false"),
      makeVar("tls_insecure_skip_verify", "bool", "false"),
      makeVar("tls_ca_file", "text", "/etc/ssl/ca.pem"),
      makeVar("tls_cert_file", "text", ""),
      makeVar("tls_key_file", "text", ""),
      makeVar("tls_server_name_override", "text", ""),
    ];
    const result = renderTemplate(APACHE_TEMPLATE, vars, {});
    expect(result.templateError).toBeNull();
    expect(result.yamlValid).toBe(true);
    expect(result.rendered).toContain("insecure: false");
    expect(result.rendered).toContain("ca_file: /etc/ssl/ca.pem");
  });

  it("renders the real Redis template with defaults to valid YAML", () => {
    const vars = [
      makeVar("endpoint", "text", "localhost:6379"),
      makeVar("collection_interval", "text", "10s"),
      makeVar("initial_delay", "text", "1s"),
      makeVar("username", "text", ""),
      makeVar("password", "text", ""),
      makeVar("transport", "text", "tcp"),
      makeVar("dialer_timeout", "text", ""),
      makeVar("tls_insecure", "bool", "true"),
      makeVar("tls_insecure_skip_verify", "bool", "false"),
      makeVar("tls_ca_file", "text", ""),
      makeVar("tls_cert_file", "text", ""),
      makeVar("tls_key_file", "text", ""),
      makeVar("tls_server_name_override", "text", ""),
      makeVar("tls_min_version", "text", ""),
      makeVar("tls_max_version", "text", ""),
      makeVar("tls_include_system_ca_certs_pool", "bool", "false"),
    ];
    const result = renderTemplate(REDIS_TEMPLATE, vars, {});
    expect(result.templateError).toBeNull();
    expect(result.yamlValid).toBe(true);
    expect(result.rendered).toContain("endpoint: localhost:6379");
    expect(result.rendered).toContain("transport: tcp");
    // username/password blocks should not appear (empty)
    expect(result.rendered).not.toContain("username:");
    expect(result.rendered).not.toContain("password:");
  });
});

describe("findUndefinedVars", () => {
  it("finds variables referenced but not defined", () => {
    const result = findUndefinedVars("endpoint: {{endpoint}}\nport: {{port}}", [
      makeVar("endpoint"),
    ]);
    expect(result).toEqual(["port"]);
  });

  it("returns empty when all vars are defined", () => {
    const result = findUndefinedVars("endpoint: {{endpoint}}", [makeVar("endpoint")]);
    expect(result).toEqual([]);
  });

  it("treats spaced variable tags as references", () => {
    const result = findUndefinedVars("endpoint: {{ endpoint }}", [makeVar("endpoint")]);
    expect(result).toEqual([]);
  });

  it("ignores block helpers like {{#if}}", () => {
    const result = findUndefinedVars("{{#if tls}}\ntls: true\n{{/if}}", [makeVar("tls")]);
    expect(result).toEqual([]);
  });

  it("finds undefined vars used in block helpers", () => {
    const result = findUndefinedVars("{{#if missing}}\nfoo: bar\n{{/if}}", [makeVar("tls")]);
    expect(result).toEqual(["missing"]);
  });

  it("finds all undefined vars in the Apache template", () => {
    const result = findUndefinedVars(APACHE_TEMPLATE, []);
    expect(result).toContain("endpoint");
    expect(result).toContain("collection_interval");
    expect(result).toContain("tls_insecure");
    expect(result.length).toBeGreaterThanOrEqual(7);
  });
});

describe("findUnusedVars", () => {
  it("finds variables defined but not referenced", () => {
    const result = findUnusedVars("endpoint: {{endpoint}}", [
      makeVar("endpoint"),
      makeVar("unused_var"),
    ]);
    expect(result).toEqual(["unused_var"]);
  });

  it("counts {{#if var}} as a reference", () => {
    const result = findUnusedVars("{{#if tls_enabled}}\ntls: true\n{{/if}}", [
      makeVar("tls_enabled"),
    ]);
    expect(result).toEqual([]);
  });

  it("treats spaced variable tags as used", () => {
    const result = findUnusedVars("endpoint: {{ endpoint }}", [makeVar("endpoint")]);
    expect(result).toEqual([]);
  });

  it("returns empty for the Apache template with all vars defined", () => {
    const apacheVars = [
      "endpoint",
      "collection_interval",
      "initial_delay",
      "timeout",
      "tls_enabled",
      "tls_insecure",
      "tls_insecure_skip_verify",
      "tls_ca_file",
      "tls_cert_file",
      "tls_key_file",
      "tls_server_name_override",
    ].map((n) => makeVar(n));

    const result = findUnusedVars(APACHE_TEMPLATE, apacheVars);
    expect(result).toEqual([]);
  });
});
