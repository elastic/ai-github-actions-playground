import YAML from "yaml";
import type { PackageBuilderData, PackageVariable } from "../../types/packageBuilder";

function serializeVariable(v: PackageVariable) {
  const out: Record<string, unknown> = {
    name: v.name,
    type: v.type,
    title: v.title,
  };
  if (v.description) out.description = v.description;
  if (v.required) out.required = true;
  if (v.default !== "") out.default = v.type === "integer" ? Number(v.default) : v.type === "bool" ? v.default === "true" : v.default;
  if (!v.showUser) out.show_user = false;
  if (v.multi) out.multi = true;
  if (v.secret) out.secret = true;
  if (v.type === "select" && v.options.length > 0) {
    out.options = v.options.map((o) => ({ text: o.text, value: o.value }));
  }
  return out;
}

export function generateManifest(data: PackageBuilderData): string {
  const { identity, policyTemplate, variables } = data;
  const fullName = identity.name.endsWith("_input_otel")
    ? identity.name
    : `${identity.name}_input_otel`;

  const manifest: Record<string, unknown> = {
    format_version: identity.formatVersion,
    name: fullName,
    title: identity.title,
    description: identity.description,
    version: identity.version,
    type: "input",
    categories: identity.categories.length > 0 ? identity.categories : ["opentelemetry"],
    conditions: {
      kibana: { version: identity.kibanaVersion },
      elastic: { subscription: identity.subscription },
    },
    owner: {
      github: identity.ownerGithub,
      type: identity.ownerType,
    },
    source: { license: "Elastic-2.0" },
  };

  if (identity.icon) {
    manifest.icons = [
      {
        src: `/img/logo_${identity.name}.svg`,
        title: `${identity.title} logo`,
        size: "32x32",
        type: identity.icon.mimeType || "image/svg+xml",
      },
    ];
  }

  const pt: Record<string, unknown> = {
    name: policyTemplate.name,
    title: policyTemplate.title,
    description: policyTemplate.description,
    input: "otelcol",
    template_path: "input.yml.hbs",
  };

  if (policyTemplate.dynamicSignalTypes && identity.formatVersion === "3.6.0") {
    pt.dynamic_signal_types = true;
  } else if (policyTemplate.signalTypes.length > 0) {
    pt.type = policyTemplate.signalTypes[0];
  }

  if (variables.length > 0) {
    pt.vars = variables.map(serializeVariable);
  }

  manifest.policy_templates = [pt];

  return YAML.stringify(manifest, {
    lineWidth: 120,
    defaultKeyType: "PLAIN",
    defaultStringType: "QUOTE_DOUBLE",
  });
}

export function generateChangelog(data: PackageBuilderData): string {
  const fullName = data.identity.name.endsWith("_input_otel")
    ? data.identity.name
    : `${data.identity.name}_input_otel`;

  return YAML.stringify([
    {
      version: data.identity.version,
      changes: [
        {
          description: `Initial release of ${fullName}`,
          type: "enhancement",
          link: "https://github.com/elastic/integrations/pull/0",
        },
      ],
    },
  ]);
}

export function generateReadmeScaffold(data: PackageBuilderData): string {
  const { identity, policyTemplate, variables } = data;
  const lines: string[] = [
    `# ${identity.title}`,
    "",
    `## Overview`,
    "",
    identity.description || "TODO: Add a description of this package.",
    "",
    `## Requirements`,
    "",
    `- Elastic Stack version ${identity.kibanaVersion.replace("^", "")}+`,
    "- Elastic Agent with OpenTelemetry Collector support",
    "",
  ];

  if (variables.length > 0) {
    lines.push(
      "## Configuration",
      "",
      "| Setting | Description | Default | Required |",
      "|---------|-------------|---------|----------|",
    );
    for (const v of variables) {
      const def = v.secret ? "\\*\\*\\*" : v.default || "-";
      lines.push(`| ${v.title || v.name} | ${v.description || "-"} | ${def} | ${v.required ? "Yes" : "No"} |`);
    }
    lines.push("");
  }

  if (policyTemplate.signalTypes.length > 0) {
    lines.push(
      `## Collected data`,
      "",
      `This package collects the following signal types: ${policyTemplate.signalTypes.join(", ")}.`,
      "",
    );
  }

  return lines.join("\n");
}
