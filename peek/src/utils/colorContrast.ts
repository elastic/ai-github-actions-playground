export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const norm =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const int = Number.parseInt(norm, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getLabelColor(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.179 ? "#000" : "#fff";
}
