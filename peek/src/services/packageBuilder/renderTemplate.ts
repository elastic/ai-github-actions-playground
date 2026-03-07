import Handlebars from "handlebars";
import YAML from "yaml";
import type { PackageVariable } from "../../types/packageBuilder";

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

  // For each multi-line variable, find where it appears in the template
  // to determine the indentation column, then fix the rendered output.
  let result = rendered;
  for (const [name, value] of multilineVars) {
    const tag = `{{${name}}}`;
    // Find the tag in the template to determine its column offset
    const tagIdx = templateSource.indexOf(tag);
    if (tagIdx === -1) continue;
    // Find the start of the line containing the tag
    const lineStart = templateSource.lastIndexOf("\n", tagIdx) + 1;
    const column = tagIdx - lineStart;
    const indent = " ".repeat(column);
    // In the rendered output, find the raw value and re-indent its lines
    const rawVal = value as string;
    const indentedVal = rawVal.split("\n").join("\n" + indent);
    if (rawVal !== indentedVal) {
      result = result.replace(rawVal, indentedVal);
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
      context[v.name] = raw === "true";
    } else if (v.type === "integer") {
      context[v.name] = raw ? Number(raw) : 0;
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

/** Find template variables referenced as {{name}} but not defined in the variable list. */
export function findUndefinedVars(
  templateSource: string,
  variables: PackageVariable[],
): string[] {
  const defined = new Set(variables.map((v) => v.name));
  const referenced = new Set<string>();
  const re = /\{\{(?!#|\/|!|>)([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(templateSource)) !== null) {
    if (m[1]) referenced.add(m[1]);
  }
  return [...referenced].filter((name) => !defined.has(name));
}

/** Find variables defined but never referenced in the template. */
export function findUnusedVars(
  templateSource: string,
  variables: PackageVariable[],
): string[] {
  const referenced = new Set<string>();
  // Match both {{name}} and {{#if name}} and {{/if name}} patterns
  const re = /\{\{[#/]?\s*(?:if|each|unless|with)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(templateSource)) !== null) {
    if (m[1]) referenced.add(m[1]);
  }
  // Also match plain {{name}}
  const rePlain = /\{\{(?!#|\/|!|>)([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  while ((m = rePlain.exec(templateSource)) !== null) {
    if (m[1]) referenced.add(m[1]);
  }
  return variables.map((v) => v.name).filter((name) => !referenced.has(name));
}
