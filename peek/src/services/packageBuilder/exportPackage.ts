import JSZip from "jszip";
import type { PackageBuilderData } from "../../types/packageBuilder";
import { generateManifest, generateChangelog } from "./generateManifest";

function iconExtensionFromMimeType(mimeType: string | undefined): "svg" | "png" | "jpg" {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "svg";
}

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
    const iconExt = iconExtensionFromMimeType(data.identity.icon.mimeType);
    root.file(`img/logo_${data.identity.name}.${iconExt}`, data.identity.icon.rawBytes);
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
  URL.revokeObjectURL(url);
}
