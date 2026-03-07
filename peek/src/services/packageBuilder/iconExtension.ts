export function iconExtensionFromMimeType(mimeType: string | undefined): "svg" | "png" | "jpg" {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "svg";
}
