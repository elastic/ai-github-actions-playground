import type { DataStreamInfo, GetDataStreamsResponse } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useFetchResource } from "./useFetchResource";

export function useDataStreams(): DataFetchResult<DataStreamInfo[]> & {
  refresh: () => void;
} {
  return useFetchResource<GetDataStreamsResponse, DataStreamInfo[]>({
    queryKey: (url) => ["data-streams", url],
    queryFn: (client) => client.getDataStreams(),
    select: (data) => data.data_streams ?? [],
  });
}
