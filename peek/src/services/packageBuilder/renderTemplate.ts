import Handlebars from "handlebars";
import YAML from "yaml";
import type { PackageVariable } from "../../types/packageBuilder";

/**
 * Register a "yaml" helper that YAML-escapes scalar values.
 * Usage in templates: {{yaml endpoint}} instead of {{endpoint}}
 * This ensures values containing #, :, quotes, or YAML sigils are properly quoted.
 */
Handlebars.registerHelper("yaml", function (value: unknown) {
  if (value == null || value === "") return "";
  const str = String(value);
  // If value is safe for YAML plain scalar, return as-is
  if (/^[a-zA-Z0-9_./ -]+$/.test(str) && !/^[&*!|>{}[\]@`]/.test(str)) {
    return str;
  }
  // Otherwise, double-quote and escape
  return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
});

export interface RenderResult {
  rendered: string;
  yamlValid: boolean;
  yamlError: string | null;
  templateError: string | null;
}

/**
 * After Handlebars renders, find multi-line string values in the output
 * and re-indent their continuation lines to match the YAML column where
 * the value starts. This is what Fleet/Agent does under the hood.
 */
function autoIndentMultilineValues(
  rendered: string,
  templateSource: string,
  context: Record<string, unknown>,
): string {
  // Find variables whose values contain newlines
  const multilineVars = Object.entries(context).filter(
    ([, v]) => typeof v === "string" && v.includes("\n"),
  );
  if (multilineVars.length === 0) return rendered;

  // For each multi-line variable, find every occurrence of the tag in the
  // template to determine the indentation column at each position, then
  // fix the corresponding occurrence in the rendered output.
  let result = rendered;
  for (const [name, value] of multilineVars) {
    // Look for both {{name}} and {{yaml name}} tags
    const tags = [`{{${name}}}`, `{{yaml ${name}}}`];
    const rawVal = value as string;

    // Collect indent columns for every occurrence of any matching tag in the template
    const indents: number[] = [];
    for (const tag of tags) {
      let searchFrom = 0;
      while (true) {
        const tagIdx = templateSource.indexOf(tag, searchFrom);
        if (tagIdx === -1) break;
        const lineStart = templateSource.lastIndexOf("\n", tagIdx) + 1;
        indents.push(tagIdx - lineStart);
        searchFrom = tagIdx + tag.length;
      }
    }
    if (indents.length === 0) continue;

    // Replace each raw value occurrence in the rendered output with its
    // properly indented version, tracking offset to handle later occurrences.
    let offset = 0;
    for (const column of indents) {
      const pos = result.indexOf(rawVal, offset);
      if (pos === -1) break;
      const indent = " ".repeat(column);
      const indentedVal = rawVal.split("\n").join("\n" + indent);
      result = result.slice(0, pos) + indentedVal + result.slice(pos + rawVal.length);
      offset = pos + indentedVal.length;
    }
  }
  return result;
}

export function renderTemplate(
  templateSource: string,
  variables: PackageVariable[],
  mockOverrides: Record<string, string>,
): RenderResult {
  // Build context from variable defaults + overrides
  const context: Record<string, unknown> = {};
  for (const v of variables) {
    const raw = mockOverrides[v.name] ?? v.default;
    if (v.type === "bool") {
      // Preserve "unset" state: empty/null -> undefined (falsy for {{#if}})
      context[v.name] = raw === "" || raw == null ? undefined : raw === "true";
    } else if (v.type === "integer") {
      // Preserve "unset" state: empty/null -> undefined instead of coercing to 0
      context[v.name] = raw === "" || raw == null ? undefined : Number(raw);
    } else {
      context[v.name] = raw;
    }
  }

  let rendered: string;
  try {
    const compiled = Handlebars.compile(templateSource, { noEscape: true });
    rendered = compiled(context);
  } catch (err) {
    return {
      rendered: "",
      yamlValid: false,
      yamlError: null,
      templateError: err instanceof Error ? err.message : String(err),
    };
  }

  // Auto-indent multi-line variable values: for each line that was produced
  // by substituting a multi-line value, indent continuation lines to match
  // the column position of the value start on the first line.
  rendered = autoIndentMultilineValues(rendered, templateSource, context);

  // Clean up excessive blank lines left by false {{#if}} blocks
  rendered = rendered.replace(/\n{3,}/g, "\n\n");

  let yamlValid = true;
  let yamlError: string | null = null;
  try {
    YAML.parse(rendered);
  } catch (err) {
    yamlValid = false;
    yamlError = err instanceof Error ? err.message : String(err);
  }

  return { rendered, yamlValid, yamlError, templateError: null };
}

/** Find template variables referenced as {{name}}, {{yaml name}}, or {{#if name}} etc. but not defined in the variable list. */
export function findUndefinedVars(templateSource: string, variables: PackageVariable[]): string[] {
  const defined = new Set(variables.map((v) => v.name));
  const referenced = new Set<string>();
  // Match plain {{name}} and helper calls like {{yaml name}}
  const rePlain = /\{\{(?!#|\/|!|>)(?:yaml\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = rePlain.exec(templateSource)) !== null) {
    if (m[1]) referenced.add(m[1]);
  }
  // Match block helpers like {{#if name}}, {{#each name}}, {{#unless name}}, {{#with name}}
  const reBlock = /\{\{[#/]\s*(?:if|each|unless|with)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  while ((m = reBlock.exec(templateSource)) !== null) {
    if (m[1]) referenced.add(m[1]);
  }
  return [...referenced].filter((name) => !defined.has(name));
}

/** Find variables defined but never referenced in the template. */
export function findUnusedVars(templateSource: string, variables: PackageVariable[]): string[] {
  const referenced = new Set<string>();
  // Match both {{name}} and {{#if name}} and {{/if name}} patterns
  const re = /\{\{[#/]?\s*(?:if|each|unless|with)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(templateSource)) !== null) {
    if (m[1]) referenced.add(m[1]);
  }
  // Also match plain {{name}} and helper calls like {{yaml name}}
  const rePlain = /\{\{(?!#|\/|!|>)(?:yaml\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  while ((m = rePlain.exec(templateSource)) !== null) {
    if (m[1]) referenced.add(m[1]);
  }
  return variables.map((v) => v.name).filter((name) => !referenced.has(name));
}
