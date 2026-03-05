export function buildCommandPreview(command: string, maxLines: number): string {
  if (maxLines <= 0) return command;
  const lines = command.split("\n");
  if (lines.length <= maxLines) return command;
  return `${lines.slice(0, maxLines).join("\n")}\n...`;
}
