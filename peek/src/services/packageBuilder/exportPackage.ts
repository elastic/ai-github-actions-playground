import JSZip from "jszip";
import type { PackageBuilderData } from "../../types/packageBuilder";
import { generateManifest, generateChangelog, getIconFileName } from "./generateManifest";

function getFullName(data: PackageBuilderData): string {
  return data.identity.name.endsWith("_input_otel")
    ? data.identity.name
    : `${data.identity.name}_input_otel`;
}

export async function exportPackageZip(data: PackageBuilderData): Promise<Blob> {
  const zip = new JSZip();
  const fullName = getFullName(data);
  const root = zip.folder(fullName)!;

  root.file("manifest.yml", generateManifest(data));
  root.file("changelog.yml", generateChangelog(data));
  root.file("agent/input/input.yml.hbs", data.templateContent);
  root.file("docs/README.md", data.readmeContent);

  if (data.identity.icon) {
    root.file(
      `img/${getIconFileName(data.identity.name, data.identity.icon)}`,
      data.identity.icon.rawBytes,
    );
  }

  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Returns true if the File System Access API is available (Chromium browsers). */
export function supportsDirectoryExport(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

async function writeFile(
  dir: FileSystemDirectoryHandle,
  path: string,
  content: FileSystemWriteChunkType,
) {
  const parts = path.split("/");
  let current = dir;
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  const fileName = parts[parts.length - 1];
  if (!fileName) throw new Error(`Invalid file path: ${path}`);
  const fileHandle = await current.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Exports the package directly to a user-selected directory using
 * the File System Access API. Files are written in place and can be
 * updated on subsequent exports without re-downloading.
 *
 * Returns the directory handle for potential reuse.
 */
export async function exportPackageToDirectory(
  data: PackageBuilderData,
  existingDir?: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle> {
  const dir = existingDir ?? (await (window as any).showDirectoryPicker({ mode: "readwrite" }));
  const root = await dir.getDirectoryHandle(getFullName(data), { create: true });

  await writeFile(root, "manifest.yml", generateManifest(data));
  await writeFile(root, "changelog.yml", generateChangelog(data));
  await writeFile(root, "agent/input/input.yml.hbs", data.templateContent);
  await writeFile(root, "docs/README.md", data.readmeContent);

  if (data.identity.icon) {
    await writeFile(
      root,
      `img/${getIconFileName(data.identity.name, data.identity.icon)}`,
      new Blob([new Uint8Array(data.identity.icon.rawBytes)]),
    );
  }

  return dir;
}
