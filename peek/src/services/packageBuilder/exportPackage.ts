import JSZip from "jszip";
import type { PackageBuilderData } from "../../types/packageBuilder";
import { generateManifest, generateChangelog, getIconFileName } from "./generateManifest";

export async function exportPackageZip(data: PackageBuilderData): Promise<Blob> {
  const zip = new JSZip();
  const fullName = data.identity.name.endsWith("_input_otel")
    ? data.identity.name
    : `${data.identity.name}_input_otel`;

  const root = zip.folder(fullName)!;

  // manifest.yml
  root.file("manifest.yml", generateManifest(data));

  // changelog.yml
  root.file("changelog.yml", generateChangelog(data));

  // agent/input/input.yml.hbs
  root.file("agent/input/input.yml.hbs", data.templateContent);

  // docs/README.md
  root.file("docs/README.md", data.readmeContent);

  // img/ (icon if present)
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
