import { describe, it, expect } from "vitest";
import YAML from "yaml";
import { generateManifest, generateChangelog } from "../../../src/services/packageBuilder/generateManifest";
import type { PackageBuilderData } from "../../../src/types/packageBuilder";

function makeData(overrides: Partial<PackageBuilderData> = {}): PackageBuilderData {
  return {
    identity: {
      name: "redis",
      title: "Redis OpenTelemetry Input Package",
      description: "Collect Redis metrics via OTel",
      version: "0.1.0",
      formatVersion: "3.5.0",
      ownerGithub: "elastic/ecosystem",
      ownerType: "elastic",
      categories: ["datastore", "opentelemetry"],
      kibanaVersion: "^9.2.0",
      subscription: "basic",
      icon: null,
    },
    policyTemplate: {
      name: "redisreceiver",
      title: "Redis Metrics (OpenTelemetry)",
      description: "Collect Redis metrics using OTel Collector",
      signalTypes: ["metrics"],
      dynamicSignalTypes: false,
    },
    variables: [
      {
        name: "endpoint",
        type: "text",
        title: "Endpoint",
        description: "Redis host:port",
        default: "localhost:6379",
        required: true,
        showUser: true,
        multi: false,
        secret: false,
        options: [],
      },
    ],
    templateContent: "receivers:\n  redis:\n    endpoint: {{endpoint}}\n",
    readmeContent: "# Redis\n",
    ...overrides,
  };
}

describe("generateManifest", () => {
  it("produces valid YAML with correct structure", () => {
    const yaml = generateManifest(makeData());
    const parsed = YAML.parse(yaml);

    expect(parsed.format_version).toBe("3.5.0");
    expect(parsed.name).toBe("redis_input_otel");
    expect(parsed.type).toBe("input");
    expect(parsed.title).toBe("Redis OpenTelemetry Input Package");
    expect(parsed.categories).toEqual(["datastore", "opentelemetry"]);
  });

  it("auto-appends _input_otel to the name", () => {
    const parsed = YAML.parse(generateManifest(makeData()));
    expect(parsed.name).toBe("redis_input_otel");
  });

  it("does not double-suffix if name already ends with _input_otel", () => {
    const data = makeData();
    data.identity.name = "redis_input_otel";
    const parsed = YAML.parse(generateManifest(data));
    expect(parsed.name).toBe("redis_input_otel");
  });

  it("includes policy_templates with input: otelcol", () => {
    const parsed = YAML.parse(generateManifest(makeData()));
    const pt = parsed.policy_templates[0];
    expect(pt.input).toBe("otelcol");
    expect(pt.template_path).toBe("input.yml.hbs");
    expect(pt.name).toBe("redisreceiver");
    expect(pt.type).toBe("metrics");
  });

  it("includes vars in the policy template", () => {
    const parsed = YAML.parse(generateManifest(makeData()));
    const vars = parsed.policy_templates[0].vars;
    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe("endpoint");
    expect(vars[0].type).toBe("text");
    expect(vars[0].required).toBe(true);
    expect(vars[0].default).toBe("localhost:6379");
  });

  it("handles bool variable defaults correctly", () => {
    const data = makeData({
      variables: [
        {
          name: "tls_enabled",
          type: "bool",
          title: "Enable TLS",
          description: "",
          default: "false",
          required: false,
          showUser: true,
          multi: false,
          secret: false,
          options: [],
        },
      ],
    });
    const parsed = YAML.parse(generateManifest(data));
    expect(parsed.policy_templates[0].vars[0].default).toBe(false);
  });

  it("handles integer variable defaults correctly", () => {
    const data = makeData({
      variables: [
        {
          name: "port",
          type: "integer",
          title: "Port",
          description: "",
          default: "6379",
          required: false,
          showUser: true,
          multi: false,
          secret: false,
          options: [],
        },
      ],
    });
    const parsed = YAML.parse(generateManifest(data));
    expect(parsed.policy_templates[0].vars[0].default).toBe(6379);
  });

  it("includes select options", () => {
    const data = makeData({
      variables: [
        {
          name: "transport",
          type: "select",
          title: "Transport",
          description: "",
          default: "tcp",
          required: false,
          showUser: false,
          multi: false,
          secret: false,
          options: [
            { text: "TCP", value: "tcp" },
            { text: "Unix", value: "unix" },
          ],
        },
      ],
    });
    const parsed = YAML.parse(generateManifest(data));
    const v = parsed.policy_templates[0].vars[0];
    expect(v.options).toEqual([
      { text: "TCP", value: "tcp" },
      { text: "Unix", value: "unix" },
    ]);
  });

  it("sets show_user: false when not shown", () => {
    const data = makeData({
      variables: [
        {
          name: "interval",
          type: "duration",
          title: "Interval",
          description: "",
          default: "10s",
          required: false,
          showUser: false,
          multi: false,
          secret: false,
          options: [],
        },
      ],
    });
    const parsed = YAML.parse(generateManifest(data));
    expect(parsed.policy_templates[0].vars[0].show_user).toBe(false);
  });

  it("omits show_user when true (default)", () => {
    const parsed = YAML.parse(generateManifest(makeData()));
    // endpoint has showUser: true, so show_user should not be emitted
    expect(parsed.policy_templates[0].vars[0].show_user).toBeUndefined();
  });

  it("includes owner and conditions", () => {
    const parsed = YAML.parse(generateManifest(makeData()));
    expect(parsed.owner.github).toBe("elastic/ecosystem");
    expect(parsed.owner.type).toBe("elastic");
    expect(parsed.conditions.kibana.version).toBe("^9.2.0");
    expect(parsed.conditions.elastic.subscription).toBe("basic");
  });

  it("uses dynamic_signal_types with format 3.6.0", () => {
    const data = makeData();
    data.identity.formatVersion = "3.6.0";
    data.policyTemplate.dynamicSignalTypes = true;
    data.policyTemplate.signalTypes = ["metrics", "logs"];

    const parsed = YAML.parse(generateManifest(data));
    const pt = parsed.policy_templates[0];
    expect(pt.dynamic_signal_types).toBe(true);
    expect(pt.type).toBeUndefined();
  });

  it("includes icon reference when icon is set", () => {
    const data = makeData();
    data.identity.icon = {
      name: "logo.svg",
      dataUrl: "data:image/svg+xml;base64,abc",
      rawBytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/svg+xml",
    };
    const parsed = YAML.parse(generateManifest(data));
    expect(parsed.icons).toHaveLength(1);
    expect(parsed.icons[0].src).toBe("/img/logo_redis.svg");
  });
});

describe("generateChangelog", () => {
  it("produces valid YAML with version and enhancement entry", () => {
    const yaml = generateChangelog(makeData());
    const parsed = YAML.parse(yaml);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].version).toBe("0.1.0");
    expect(parsed[0].changes).toHaveLength(1);
    expect(parsed[0].changes[0].type).toBe("enhancement");
    expect(parsed[0].changes[0].description).toContain("redis_input_otel");
  });
});
