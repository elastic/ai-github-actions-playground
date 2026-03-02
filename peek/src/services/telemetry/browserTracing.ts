import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { UserInteractionInstrumentation } from "@opentelemetry/instrumentation-user-interaction";

import appPackage from "../../../package.json";
import type { ElasticsearchConnection } from "../es";
import { deriveOtlpEndpoint } from "../../utils/addDataUtils";

export const EDOT_DISTRO_NAME = "elastic";
const APP_VERSION = typeof appPackage.version === "string" ? appPackage.version : "0.0.0";
export const EDOT_DISTRO_VERSION = APP_VERSION;

export interface BrowserTracingStartConfig {
  enabled: boolean;
  endpoint?: string;
  headers?: Record<string, string>;
  propagateTraceHeaderCorsUrls?: string[];
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
}

interface TracingConnectionSnapshot {
  connected: boolean;
  url: string;
  proxyUrl: string;
  ingestUrl: string;
  otlpEnabled: boolean;
  otlpEndpoint: string;
  otlpUseElasticAuth: boolean;
  apiKey: string;
  otlpApiKey: string;
}

let activeProvider: WebTracerProvider | null = null;
let activeInstrumentations: Array<
  DocumentLoadInstrumentation | FetchInstrumentation | UserInteractionInstrumentation
> = [];
let activeConfigKey = "";

export function deriveDefaultOtlpEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = "/v1/traces";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function getTracingConnectionSnapshot(
  connection: ElasticsearchConnection | null | undefined,
  connected: boolean,
): TracingConnectionSnapshot {
  return {
    connected,
    url: (connection?.url ?? "").trim(),
    proxyUrl: (connection?.proxyUrl ?? "").trim(),
    ingestUrl: (connection?.ingestUrl ?? "").trim(),
    otlpEnabled: connection?.otlpEnabled ?? false,
    otlpEndpoint: (connection?.otlpEndpoint ?? "").trim(),
    otlpUseElasticAuth: connection?.otlpUseElasticAuth ?? true,
    apiKey: (connection?.apiKey ?? "").trim(),
    otlpApiKey: (connection?.otlpApiKey ?? "").trim(),
  };
}

export function shouldReconfigureTracing(
  previous: TracingConnectionSnapshot,
  next: TracingConnectionSnapshot,
): boolean {
  return (
    previous.connected !== next.connected ||
    previous.url !== next.url ||
    previous.proxyUrl !== next.proxyUrl ||
    previous.ingestUrl !== next.ingestUrl ||
    previous.otlpEnabled !== next.otlpEnabled ||
    previous.otlpEndpoint !== next.otlpEndpoint ||
    previous.otlpUseElasticAuth !== next.otlpUseElasticAuth ||
    previous.apiKey !== next.apiKey ||
    previous.otlpApiKey !== next.otlpApiKey
  );
}

function buildConfigKey(config: BrowserTracingStartConfig): string {
  return JSON.stringify({
    enabled: config.enabled,
    endpoint: config.endpoint ?? "",
    headers: config.headers ?? {},
    propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls ?? [],
    serviceName: config.serviceName ?? "",
    serviceVersion: config.serviceVersion ?? "",
    environment: config.environment ?? "",
  });
}

function parseUrlOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function getTraceHeaderCorsUrls(connection: ElasticsearchConnection, endpoint: string): string[] {
  const candidates = [connection.url, connection.proxyUrl, endpoint]
    .map((value) => parseUrlOrigin((value ?? "").trim()))
    .filter(Boolean);
  return [...new Set(candidates)];
}

export function getOtlpAuthHeaders(connection: ElasticsearchConnection): Record<string, string> {
  const useElasticAuth = connection.otlpUseElasticAuth ?? true;
  const token =
    connection.otlpApiKey?.trim() || (useElasticAuth ? connection.apiKey?.trim() : undefined) || "";
  return token ? { Authorization: `ApiKey ${token}` } : {};
}

export async function stopBrowserTracing(): Promise<void> {
  const provider = activeProvider;
  const instrumentations = activeInstrumentations;

  activeProvider = null;
  activeInstrumentations = [];
  activeConfigKey = "";

  for (const instrumentation of instrumentations) {
    instrumentation.disable();
  }
  if (provider) {
    await provider.shutdown();
  }
}

export async function startBrowserTracing(config: BrowserTracingStartConfig): Promise<void> {
  const endpoint = config.endpoint?.trim() ?? "";
  if (!config.enabled || !endpoint) {
    await stopBrowserTracing();
    return;
  }

  const nextConfigKey = buildConfigKey({ ...config, endpoint });
  if (activeProvider && activeConfigKey === nextConfigKey) {
    return;
  }

  await stopBrowserTracing();

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      "service.name": config.serviceName ?? "elastic-peek",
      "service.version": config.serviceVersion ?? "0.0.0",
      "deployment.environment": config.environment ?? "browser",
      "telemetry.distro.name": EDOT_DISTRO_NAME,
      "telemetry.distro.version": EDOT_DISTRO_VERSION,
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: endpoint,
          headers: config.headers,
        }),
      ),
    ],
  });
  provider.register();

  const instrumentations = [
    new DocumentLoadInstrumentation(),
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls ?? [],
      clearTimingResources: true,
    }),
    new UserInteractionInstrumentation(),
  ];
  for (const instrumentation of instrumentations) {
    instrumentation.setTracerProvider(provider);
    instrumentation.enable();
  }

  activeProvider = provider;
  activeInstrumentations = instrumentations;
  activeConfigKey = nextConfigKey;
}

export async function syncBrowserTracingForConnection(
  connection: ElasticsearchConnection | null | undefined,
  connected: boolean,
): Promise<void> {
  if (!connected || !connection || !connection.otlpEnabled) {
    await stopBrowserTracing();
    return;
  }

  const ingestBase =
    connection.ingestUrl?.trim() || deriveOtlpEndpoint(connection.url) || connection.url;
  const endpoint = connection.otlpEndpoint?.trim() || deriveDefaultOtlpEndpoint(ingestBase);
  if (!endpoint) {
    await stopBrowserTracing();
    return;
  }

  await startBrowserTracing({
    enabled: true,
    endpoint,
    headers: getOtlpAuthHeaders(connection),
    propagateTraceHeaderCorsUrls: getTraceHeaderCorsUrls(connection, endpoint),
    serviceName: "elastic-peek",
    serviceVersion: APP_VERSION,
    environment: import.meta.env.MODE,
  });
}
