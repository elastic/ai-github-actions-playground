import { useCallback, useEffect, useReducer } from "react";

import { deriveDefaultOtlpEndpoint } from "../services/telemetry/browserTracing";
import { deriveOtlpEndpoint } from "../utils/addDataUtils";
import type { ElasticsearchConnection } from "../types";

export type AuthType = "apiKey" | "userpass" | "none";

interface ConnectionFormState {
  url: string;
  authType: AuthType;
  apiKey: string;
  username: string;
  password: string;
  proxyUrl: string;
  ingestUrl: string;
  showAdvanced: boolean;
  otlpEnabled: boolean;
  otlpEndpoint: string;
  otlpUseElasticAuth: boolean;
  otlpApiKey: string;
  showSecret: boolean;
}

type ConnectionFormAction =
  | { type: "hydrate"; connection: ElasticsearchConnection | null | undefined }
  | { type: "setUrl"; value: string }
  | { type: "setAuthType"; value: AuthType }
  | { type: "setApiKey"; value: string }
  | { type: "setUsername"; value: string }
  | { type: "setPassword"; value: string }
  | { type: "setProxyUrl"; value: string }
  | { type: "setIngestUrl"; value: string }
  | { type: "setShowAdvanced"; value: boolean }
  | { type: "setOtlpEnabled"; value: boolean }
  | { type: "setOtlpEndpoint"; value: string }
  | { type: "setOtlpUseElasticAuth"; value: boolean }
  | { type: "setOtlpApiKey"; value: string }
  | { type: "setShowSecret"; value: boolean };

function deriveAuthType(
  conn: Pick<ElasticsearchConnection, "username" | "apiKey"> | null | undefined,
): AuthType {
  if (conn?.username) return "userpass";
  if (conn?.apiKey) return "apiKey";
  return conn ? "none" : "apiKey";
}

function deriveIngestUrlOrEmpty(url: string | undefined): string {
  return deriveOtlpEndpoint(url ?? "") ?? "";
}

function resetFormFromConnection(
  connection: ElasticsearchConnection | null | undefined,
): ConnectionFormState {
  const conn = connection ?? null;
  return {
    url: conn?.url ?? "",
    authType: deriveAuthType(conn),
    apiKey: conn?.apiKey ?? "",
    username: conn?.username ?? "",
    password: conn?.password ?? "",
    proxyUrl: conn?.proxyUrl ?? "",
    ingestUrl: conn?.ingestUrl ?? deriveIngestUrlOrEmpty(conn?.url),
    showAdvanced: Boolean(conn?.ingestUrl),
    otlpEnabled: conn?.otlpEnabled ?? false,
    otlpEndpoint: conn?.otlpEndpoint ?? deriveDefaultOtlpEndpoint(conn?.url ?? ""),
    otlpUseElasticAuth: conn?.otlpUseElasticAuth ?? Boolean(conn?.apiKey),
    otlpApiKey: conn?.otlpApiKey ?? "",
    showSecret: false,
  };
}

function reducer(state: ConnectionFormState, action: ConnectionFormAction): ConnectionFormState {
  switch (action.type) {
    case "hydrate":
      return resetFormFromConnection(action.connection);
    case "setUrl": {
      const previousDerivedOtlp = deriveDefaultOtlpEndpoint(state.url);
      const previousDerivedIngest = deriveIngestUrlOrEmpty(state.url);
      const nextOtlpEndpoint = (() => {
        const trimmed = state.otlpEndpoint.trim();
        if (!trimmed || trimmed === previousDerivedOtlp) {
          return deriveDefaultOtlpEndpoint(action.value);
        }
        return state.otlpEndpoint;
      })();
      const nextIngestUrl = (() => {
        const trimmed = state.ingestUrl.trim();
        if (!trimmed || trimmed === previousDerivedIngest) {
          return deriveIngestUrlOrEmpty(action.value);
        }
        return state.ingestUrl;
      })();
      return {
        ...state,
        url: action.value,
        otlpEndpoint: nextOtlpEndpoint,
        ingestUrl: nextIngestUrl,
      };
    }
    case "setAuthType":
      return {
        ...state,
        authType: action.value,
        otlpUseElasticAuth: action.value === "apiKey" ? state.otlpUseElasticAuth : false,
      };
    case "setApiKey":
      return { ...state, apiKey: action.value };
    case "setUsername":
      return { ...state, username: action.value };
    case "setPassword":
      return { ...state, password: action.value };
    case "setProxyUrl":
      return { ...state, proxyUrl: action.value };
    case "setIngestUrl":
      return { ...state, ingestUrl: action.value };
    case "setShowAdvanced":
      return { ...state, showAdvanced: action.value };
    case "setOtlpEnabled":
      return { ...state, otlpEnabled: action.value };
    case "setOtlpEndpoint":
      return { ...state, otlpEndpoint: action.value };
    case "setOtlpUseElasticAuth":
      return { ...state, otlpUseElasticAuth: action.value };
    case "setOtlpApiKey":
      return { ...state, otlpApiKey: action.value };
    case "setShowSecret":
      return { ...state, showSecret: action.value };
    default:
      return state;
  }
}

export function useConnectionDialogForm(
  savedConnection: ElasticsearchConnection | null,
  onDirty: () => void,
) {
  const [form, dispatch] = useReducer(reducer, resetFormFromConnection(savedConnection));

  useEffect(() => {
    dispatch({ type: "hydrate", connection: savedConnection });
  }, [savedConnection]);

  const setHydratedConnection = useCallback((connection: ElasticsearchConnection) => {
    dispatch({ type: "hydrate", connection });
  }, []);

  const updateUrl = useCallback(
    (value: string) => {
      onDirty();
      dispatch({ type: "setUrl", value });
    },
    [onDirty],
  );
  const updateAuthType = useCallback(
    (value: AuthType) => {
      onDirty();
      dispatch({ type: "setAuthType", value });
    },
    [onDirty],
  );

  const markDirtyDispatch = useCallback(
    (action: ConnectionFormAction) => {
      onDirty();
      dispatch(action);
    },
    [onDirty],
  );

  const buildConnection = useCallback((): ElasticsearchConnection => {
    const nextOtlpUseElasticAuth = form.authType === "apiKey" && form.otlpUseElasticAuth;
    const trimmedIngestUrl = form.ingestUrl.trim();
    const derivedIngestUrl = deriveIngestUrlOrEmpty(form.url.trim());
    const effectiveIngestUrl =
      trimmedIngestUrl && trimmedIngestUrl !== derivedIngestUrl ? trimmedIngestUrl : undefined;

    if (form.authType === "userpass") {
      return {
        url: form.url.trim(),
        username: form.username.trim(),
        password: form.password.trim(),
        proxyUrl: form.proxyUrl.trim(),
        ingestUrl: effectiveIngestUrl,
        otlpEnabled: form.otlpEnabled,
        otlpEndpoint: form.otlpEndpoint.trim(),
        otlpUseElasticAuth: nextOtlpUseElasticAuth,
        otlpApiKey: form.otlpApiKey.trim(),
      };
    }
    if (form.authType === "none") {
      return {
        url: form.url.trim(),
        proxyUrl: form.proxyUrl.trim(),
        ingestUrl: effectiveIngestUrl,
        otlpEnabled: form.otlpEnabled,
        otlpEndpoint: form.otlpEndpoint.trim(),
        otlpUseElasticAuth: false,
        otlpApiKey: "",
      };
    }
    return {
      url: form.url.trim(),
      apiKey: form.apiKey.trim(),
      proxyUrl: form.proxyUrl.trim(),
      ingestUrl: effectiveIngestUrl,
      otlpEnabled: form.otlpEnabled,
      otlpEndpoint: form.otlpEndpoint.trim(),
      otlpUseElasticAuth: nextOtlpUseElasticAuth,
      otlpApiKey: form.otlpApiKey.trim(),
    };
  }, [form]);

  return {
    form,
    buildConnection,
    setHydratedConnection,
    updateUrl,
    updateAuthType,
    setApiKey: (value: string) => markDirtyDispatch({ type: "setApiKey", value }),
    setUsername: (value: string) => markDirtyDispatch({ type: "setUsername", value }),
    setPassword: (value: string) => markDirtyDispatch({ type: "setPassword", value }),
    setProxyUrl: (value: string) => markDirtyDispatch({ type: "setProxyUrl", value }),
    setIngestUrl: (value: string) => markDirtyDispatch({ type: "setIngestUrl", value }),
    setShowAdvanced: (value: boolean) => dispatch({ type: "setShowAdvanced", value }),
    setOtlpEnabled: (value: boolean) => markDirtyDispatch({ type: "setOtlpEnabled", value }),
    setOtlpEndpoint: (value: string) => markDirtyDispatch({ type: "setOtlpEndpoint", value }),
    setOtlpUseElasticAuth: (value: boolean) =>
      markDirtyDispatch({ type: "setOtlpUseElasticAuth", value }),
    setOtlpApiKey: (value: string) => markDirtyDispatch({ type: "setOtlpApiKey", value }),
    setShowSecret: (value: boolean) => dispatch({ type: "setShowSecret", value }),
  };
}

export function isLikelyServerlessUrl(rawUrl: string): boolean {
  try {
    const hostname = new URL(rawUrl.trim()).hostname.toLowerCase();
    return hostname.endsWith(".elastic.cloud") || hostname === "elastic.cloud";
  } catch {
    return false;
  }
}
