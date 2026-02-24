export function getTypeColor(
  type: string,
): "default" | "primary" | "secondary" | "success" | "warning" {
  if (type === "date" || type === "date_nanos") return "warning";
  if (
    type === "long" ||
    type === "integer" ||
    type === "double" ||
    type === "float" ||
    type === "short" ||
    type === "byte"
  )
    return "primary";
  if (type === "boolean") return "secondary";
  if (type === "keyword" || type === "text" || type === "ip" || type === "version")
    return "success";
  return "default";
}
