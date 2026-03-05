import type { ToolSet } from "ai";

import type { LLMConfig } from "../store/useLLMStore";

import { getElasticDocsTools, resetMcpSession } from "./elasticDocsMcp";

const MCP_TIMEOUT_MS = 30_000;

export interface McpToolProvider {
  id: string;
  enabled: (config: LLMConfig) => boolean;
  getTools: (signal?: AbortSignal) => Promise<ToolSet>;
  onError?: (error: unknown) => void;
  timeoutMs: number;
  stepCountLimit: number;
  systemInstruction: string;
}

export const MCP_TOOL_PROVIDERS: McpToolProvider[] = [
  {
    id: "elastic-docs",
    enabled: (config) => config.elasticDocsEnabled,
    getTools: (signal) => getElasticDocsTools(signal),
    onError: (error) => {
      console.warn("Elastic Docs MCP tool discovery failed:", error);
      resetMcpSession();
    },
    timeoutMs: MCP_TIMEOUT_MS,
    stepCountLimit: 3,
    systemInstruction:
      "You have access to Elastic documentation search tools. " +
      "Use them when the user asks about Elasticsearch features, APIs, ES|QL syntax, or configuration. " +
      "Do NOT use them for general data questions that can be answered by querying the cluster directly.",
  },
];

export interface McpDiscoveryResult {
  tools: ToolSet;
  mcpInstructions: string[];
  maxStepCountLimit: number;
}

export async function discoverMcpTools(
  config: LLMConfig,
  existingTools: ToolSet,
  signal?: AbortSignal,
): Promise<McpDiscoveryResult> {
  const tools: ToolSet = { ...existingTools };
  const mcpInstructions: string[] = [];
  let maxStepCountLimit = 0;

  /* eslint-disable no-await-in-loop -- sequential: each provider checks for tool name collisions with previous ones */
  for (const provider of MCP_TOOL_PROVIDERS) {
    if (!provider.enabled(config)) continue;
    try {
      const providerTools = await provider.getTools(signal);
      if (Object.keys(providerTools).length === 0) continue;
      const entries = Object.entries(providerTools);
      for (const [toolName] of entries) {
        if (toolName in tools) {
          throw new Error(`Tool name collision detected: ${toolName}`);
        }
      }
      for (const [toolName, toolDef] of entries) {
        tools[toolName] = toolDef;
      }
      mcpInstructions.push(provider.systemInstruction);
      maxStepCountLimit = Math.max(maxStepCountLimit, provider.stepCountLimit);
    } catch (error: unknown) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw error;
      }
      provider.onError?.(error);
    }
  }
  /* eslint-enable no-await-in-loop */

  return { tools, mcpInstructions, maxStepCountLimit };
}
