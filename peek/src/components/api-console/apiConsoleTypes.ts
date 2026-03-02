import type { ElasticsearchConnection } from "../../services/es";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";

export interface RequestEntry {
  id: string;
  method: HttpMethod;
  path: string;
  body: string;
  response: ResponseState | null;
}

export type ResponseState =
  | { status: "loading" }
  | { status: "success"; httpStatus: number; body: unknown; executionTimeMs: number }
  | { status: "error"; message: string };

export const METHOD_COLORS: Record<
  HttpMethod,
  "success" | "primary" | "warning" | "error" | "secondary" | "default"
> = {
  GET: "success",
  POST: "primary",
  PUT: "warning",
  DELETE: "error",
  PATCH: "secondary",
  HEAD: "default",
};

export const METHODS_WITH_BODY: readonly HttpMethod[] = ["POST", "PUT", "PATCH"];

export function httpStatusColor(status: number): "success" | "warning" | "error" | "default" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 400 && status < 500) return "warning";
  if (status >= 500) return "error";
  return "default";
}

export function makeEntry({
  id = crypto.randomUUID(),
  method = "GET" as HttpMethod,
  path = "/",
  body = "",
  response = null,
}: Partial<RequestEntry> = {}): RequestEntry {
  return { id, method, path, body, response };
}

export interface RequestCardProps {
  entry: RequestEntry;
  themeMode: "light" | "dark";
  connection: ElasticsearchConnection | null;
  onUpdate: (id: string, updates: Partial<RequestEntry>) => void;
  onRemove: (id: string) => void;
  onSend: (id: string) => void;
  onCancel: (id: string) => void;
  removable: boolean;
}
