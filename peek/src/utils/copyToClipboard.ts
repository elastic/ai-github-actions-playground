export function copyToClipboard(text: string): Promise<boolean> {
  const clipboard = navigator.clipboard;
  if (!clipboard?.writeText) return Promise.resolve(false);

  return clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}
