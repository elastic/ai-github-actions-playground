import JSZip from "jszip";
import YAML from "yaml";
import type {
  FormatVersion,
  OwnerType,
  PackageBuilderData,
  PackageIcon,
  PackageVariable,
  SignalType,
  SubscriptionLevel,
  VariableType,
} from "../../types/packageBuilder";

const VALID_VARIABLE_TYPES = new Set([
  "bool", "email", "integer", "password", "select",
  "text", "textarea", "time_zone", "url", "yaml", "duration",
]);

const VALID_SIGNAL_TYPES = new Set(["metrics", "logs", "traces", "synthetics", "profiles"]);

interface ParsedFiles {
  manifest?: string;
  template?: string;
  readme?: string;
  iconFile?: { name: string; bytes: Uint8Array; mimeType: string };
}

/** Collect files from a flat map of path → content (works for both zip and folder upload). */
function collectFiles(files: Map<string, Uint8Array>): ParsedFiles {
  const result: ParsedFiles = {};
  const decoder = new TextDecoder();

  for (const [path, bytes] of files) {
    // Normalize: strip leading package folder name (e.g. "redis_input_otel/manifest.yml" → "manifest.yml")
    const normalized = path.replace(/^[^/]+\//, "");

    if (normalized === "manifest.yml") {
      result.manifest = decoder.decode(bytes);
    } else if (normalized === "agent/input/input.yml.hbs") {
      result.template = decoder.decode(bytes);
    } else if (normalized === "docs/README.md") {
      result.readme = decoder.decode(bytes);
    } else if (/^img\/.*\.(svg|png|jpg|jpeg)$/i.test(normalized)) {
      const ext = normalized.split(".").pop()?.toLowerCase() ?? "svg";
      const mimeMap: Record<string, string> = {
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
      };
      result.iconFile = {
        name: normalized.split("/").pop() ?? "icon",
        bytes,
        mimeType: mimeMap[ext] ?? "image/svg+xml",
      };
    }
  }

  return result;
}

function parseManifestVariable(raw: Record<string, unknown>): PackageVariable {
  const rawDefault = raw.default;
  let defaultStr = "";
  if (typeof rawDefault === "boolean") defaultStr = String(rawDefault);
  else if (typeof rawDefault === "number") defaultStr = String(rawDefault);
  else if (typeof rawDefault === "string") defaultStr = rawDefault;

  const rawType = String(raw.type ?? "text");

  return {
    name: String(raw.name ?? ""),
    type: VALID_VARIABLE_TYPES.has(rawType) ? (rawType as VariableType) : "text",
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    default: defaultStr,
    required: Boolean(raw.required),
    showUser: raw.show_user !== false,
    multi: Boolean(raw.multi),
    secret: Boolean(raw.secret),
    options: Array.isArray(raw.options)
      ? raw.options.map((o: Record<string, unknown>) => ({
          text: String(o.text ?? ""),
          value: String(o.value ?? ""),
        }))
      : [],
  };
}

function parseManifest(yamlContent: string): Omit<PackageBuilderData, "templateContent" | "readmeContent"> & { iconPath?: string } {
  let doc: Record<string, unknown>;
  try {
    doc = YAML.parse(yamlContent) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Invalid manifest.yml: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Identity
  const rawName = String(doc.name ?? "");
  const name = rawName.replace(/_input_otel$/, "");
  const rawFormatVersion = String(doc.format_version ?? "3.5.0");
  const formatVersion: FormatVersion = rawFormatVersion === "3.6.0" ? "3.6.0" : "3.5.0";

  const owner = (doc.owner ?? {}) as Record<string, unknown>;
  const ownerType = String(owner.type ?? "elastic");
  const conditions = (doc.conditions ?? {}) as Record<string, Record<string, unknown>>;
  const kibanaVersion = String(conditions.kibana?.version ?? "^9.2.0");
  const subscription = String(conditions.elastic?.subscription ?? "basic");

  const icons = Array.isArray(doc.icons) ? doc.icons as Record<string, unknown>[] : [];
  const firstIcon = icons[0];
  const iconPath = firstIcon ? String(firstIcon.src ?? "") : undefined;

  const identity = {
    name,
    title: String(doc.title ?? ""),
    description: String(doc.description ?? ""),
    version: String(doc.version ?? "0.1.0"),
    formatVersion,
    ownerGithub: String(owner.github ?? "elastic/ecosystem"),
    ownerType: (["elastic", "partner", "community"].includes(ownerType) ? ownerType : "elastic") as OwnerType,
    categories: Array.isArray(doc.categories) ? doc.categories.map(String) : ["opentelemetry"],
    kibanaVersion,
    subscription: (["basic", "gold", "platinum", "enterprise"].includes(subscription) ? subscription : "basic") as SubscriptionLevel,
    icon: null as PackageIcon | null,
  };

  // Policy template
  const policyTemplates = Array.isArray(doc.policy_templates)
    ? (doc.policy_templates as Record<string, unknown>[])
    : [];
  const pt = policyTemplates[0] ?? {};

  const rawSignalType = pt.type ? String(pt.type) : null;
  const signalTypes: SignalType[] = rawSignalType && VALID_SIGNAL_TYPES.has(rawSignalType)
    ? [rawSignalType as SignalType]
    : ["metrics"];

  const policyTemplate = {
    name: String(pt.name ?? ""),
    title: String(pt.title ?? ""),
    description: String(pt.description ?? ""),
    signalTypes,
    dynamicSignalTypes: Boolean(pt.dynamic_signal_types),
  };

  // Variables
  const rawVars = Array.isArray(pt.vars) ? (pt.vars as Record<string, unknown>[]) : [];
  const variables = rawVars.map(parseManifestVariable);

  return { identity, policyTemplate, variables, iconPath };
}

async function bytesToPackageIcon(
  name: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<PackageIcon> {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  return { name, dataUrl, rawBytes: bytes, mimeType };
}

export interface ImportResult {
  data: PackageBuilderData;
  warnings: string[];
}

export async function importFromZip(zipFile: File): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(zipFile);
  const fileMap = new Map<string, Uint8Array>();

  const promises: Promise<void>[] = [];
  zip.forEach((path, entry) => {
    if (!entry.dir) {
      promises.push(
        entry.async("uint8array").then((bytes) => {
          fileMap.set(path, bytes);
        }),
      );
    }
  });
  await Promise.all(promises);

  return importFromFileMap(fileMap);
}

export async function importFromFolder(fileList: FileList): Promise<ImportResult> {
  const fileMap = new Map<string, Uint8Array>();

  const promises = Array.from(fileList).map(async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // webkitRelativePath gives "folderName/sub/file.txt"
    fileMap.set(file.webkitRelativePath || file.name, bytes);
  });
  await Promise.all(promises);

  return importFromFileMap(fileMap);
}

export async function importFromFileMap(fileMap: Map<string, Uint8Array>): Promise<ImportResult> {
  const warnings: string[] = [];
  const parsed = collectFiles(fileMap);

  if (!parsed.manifest) {
    throw new Error("No manifest.yml found in the package.");
  }

  const { identity, policyTemplate, variables, iconPath } = parseManifest(parsed.manifest);

  // Resolve icon
  if (parsed.iconFile) {
    identity.icon = await bytesToPackageIcon(
      parsed.iconFile.name,
      parsed.iconFile.bytes,
      parsed.iconFile.mimeType,
    );
  } else if (iconPath) {
    warnings.push(`Icon referenced in manifest (${iconPath}) was not found in package files.`);
  }

  if (!parsed.template) {
    warnings.push("No agent/input/input.yml.hbs found. Template content will be empty.");
  }

  if (!parsed.readme) {
    warnings.push("No docs/README.md found. README content will be empty.");
  }

  return {
    data: {
      identity,
      policyTemplate,
      variables,
      templateContent: parsed.template ?? "",
      readmeContent: parsed.readme ?? "",
    },
    warnings,
  };
}
