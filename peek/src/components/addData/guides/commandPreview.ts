export function buildCommandPreview(command: string, maxLines: number): string {
  const lines = command.split("\n");
  if (lines.length <= maxLines) return command;
  return `${lines.slice(0, maxLines).join("\n")}\n...`;
}
