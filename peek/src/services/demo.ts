export interface DemoConfig {
  url: string;
  username: string;
  password: string;
}

function isValidDemoConfig(data: unknown): data is DemoConfig {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.url === "string" &&
    obj.url.length > 0 &&
    typeof obj.username === "string" &&
    obj.username.length > 0 &&
    typeof obj.password === "string" &&
    obj.password.length > 0
  );
}

/**
 * Fetches the optional demo configuration published alongside the app.
 *
 * Returns `null` when the file is absent (404) or malformed — the caller
 * should treat this as "demo mode unavailable" rather than an error.
 */
export async function fetchDemoConfig(baseUrl?: string): Promise<DemoConfig | null> {
  const base = baseUrl ?? import.meta.env.BASE_URL ?? "/";
  const url = `${base.replace(/\/+$/, "")}/demo.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isValidDemoConfig(data) ? data : null;
  } catch {
    return null;
  }
}
