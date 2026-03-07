const REPO = "elastic/integrations";
const BRANCH = "main";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/refs/heads/${BRANCH}`;
const API_BASE = `https://api.github.com/repos/${REPO}`;

export interface CatalogEntry {
  /** Directory name, e.g. "redis_input_otel" */
  dirName: string;
  /** Display label, e.g. "Redis" */
  label: string;
}

/** List all _input_otel packages in the repo (cached in-memory). */
let catalogCache: CatalogEntry[] | null = null;

export async function listInputPackages(signal?: AbortSignal): Promise<CatalogEntry[]> {
  if (catalogCache) return catalogCache;

  const res = await fetch(`${API_BASE}/contents/packages?ref=${BRANCH}`, { signal });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

  const items = (await res.json()) as { name: string; type: string }[];
  const packages = items
    .filter((item) => item.type === "dir" && item.name.endsWith("_input_otel"))
    .map((item) => ({
      dirName: item.name,
      label: item.name
        .replace(/_input_otel$/, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  catalogCache = packages;
  return packages;
}

/** Files we care about for import. */
const PACKAGE_FILES = ["manifest.yml", "agent/input/input.yml.hbs", "docs/README.md"] as const;

/**
 * Fetch the key files of a package and return them as a file map
 * compatible with `importFromFileMap`.
 */
export async function fetchPackageFiles(
  dirName: string,
  signal?: AbortSignal,
): Promise<Map<string, Uint8Array>> {
  const encoder = new TextEncoder();
  const fileMap = new Map<string, Uint8Array>();

  // Fetch text files in parallel
  const textFetches = PACKAGE_FILES.map(async (relPath) => {
    const url = `${RAW_BASE}/packages/${dirName}/${relPath}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return; // Skip missing files (e.g. README may not exist)
    const text = await res.text();
    fileMap.set(`${dirName}/${relPath}`, encoder.encode(text));
  });

  // Also try to fetch the icon — check the manifest first for the icon path,
  // but also try common patterns
  const iconFetch = (async () => {
    // First fetch manifest to find icon reference
    const manifestUrl = `${RAW_BASE}/packages/${dirName}/manifest.yml`;
    const manifestRes = await fetch(manifestUrl, { signal });
    if (!manifestRes.ok) return;
    const manifestText = await manifestRes.text();

    // Quick regex to find icon src path
    const iconMatch = manifestText.match(/src:\s*\/img\/(.+)/);
    if (!iconMatch) return;

    const iconFileName = iconMatch[1]?.trim();
    if (!iconFileName) return;
    const iconUrl = `${RAW_BASE}/packages/${dirName}/img/${iconFileName}`;
    const iconRes = await fetch(iconUrl, { signal });
    if (!iconRes.ok) return;

    const bytes = new Uint8Array(await iconRes.arrayBuffer());
    fileMap.set(`${dirName}/img/${iconFileName}`, bytes);
  })();

  await Promise.all([...textFetches, iconFetch]);
  return fileMap;
}
