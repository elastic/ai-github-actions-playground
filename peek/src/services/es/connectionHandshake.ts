import { ElasticsearchClient } from "./client";
import type { ElasticsearchConnection, UserCapabilities } from "./client";

export async function fetchCapabilitiesForConnection(
  connection: ElasticsearchConnection,
): Promise<UserCapabilities> {
  const client = new ElasticsearchClient(connection);
  await client.getClusterInfo();
  return client.getCapabilities();
}
