import { useQuery } from "@tanstack/react-query";

import type {
  GetIlmPoliciesResponse,
  IlmExplainDetailResponse,
  IlmIndexRow,
  IlmPolicyRow,
} from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

export interface IlmData {
  indexRows: IlmIndexRow[];
  policyRows: IlmPolicyRow[];
}

function toIlmData(results: [GetIlmPoliciesResponse, IlmExplainDetailResponse]): IlmData {
  const [policies, explain] = results;
  const indices = explain.indices ?? {};

  const indexRows: IlmIndexRow[] = Object.entries(indices).map(([index, detail]) => ({
    index,
    policy: detail.policy ?? "",
    phase: detail.phase ?? "",
    action: detail.action ?? "",
    step: detail.step ?? "",
    age: detail.age ?? "",
    failedStep: detail.failed_step ?? "",
    isError: Boolean(detail.step_info?.reason),
    stepReason: detail.step_info?.reason ?? "",
    raw: detail,
  }));

  const policyRows: IlmPolicyRow[] = Object.entries(policies).map(([name, policy]) => ({
    name,
    version: policy.version ?? 0,
    modifiedDate: policy.modified_date_string ?? policy.modified_date ?? "",
    phases: Object.keys(policy.policy?.phases ?? {}),
    indexCount: policy.in_use_by?.indices?.length ?? 0,
    dataStreamCount: policy.in_use_by?.data_streams?.length ?? 0,
    templateCount: policy.in_use_by?.composable_templates?.length ?? 0,
    raw: policy,
  }));

  return { indexRows, policyRows };
}

export function useIlm(): DataFetchResult<IlmData> & { refresh: () => void } {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["ilm", connection?.url],
    queryFn: createQueryFn((client) =>
      Promise.all([client.getIlmPolicies(), client.getIlmExplain()]),
    ),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    select: toIlmData,
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const refresh = () => {
    void query.refetch();
  };

  if (!connection) return { status: "idle", refresh };
  if (query.isFetching) return { status: "loading", refresh };
  if (query.isError) return { status: "error", error: query.error.message, refresh };
  if (query.data) return { status: "success", data: query.data, refresh };
  return { status: "idle", refresh };
}
