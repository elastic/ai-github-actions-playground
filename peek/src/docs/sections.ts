import aboutRaw from "./about.md?raw";
import connectingRaw from "./connecting.md?raw";
import corsRaw from "./cors.md?raw";
import proxyModeRaw from "./proxy-mode.md?raw";
import dashboardWorkflowRaw from "./dashboard-workflow.md?raw";
import discoverWorkflowRaw from "./discover-workflow.md?raw";
import metricsWorkflowRaw from "./metrics-workflow.md?raw";
import tracesWorkflowRaw from "./traces-workflow.md?raw";
import profilingWorkflowRaw from "./profiling-workflow.md?raw";
import visualizationsRaw from "./visualizations.md?raw";
import keyboardShortcutsRaw from "./keyboard-shortcuts.md?raw";
import consoleRaw from "./console.md?raw";
import dataStreamsRaw from "./data-streams.md?raw";
import chatRaw from "./chat.md?raw";
import llmSettingsRaw from "./llm-settings.md?raw";
import clusterOverviewRaw from "./cluster-overview.md?raw";
import dashboardManagementRaw from "./dashboard-management.md?raw";
import usersRolesRaw from "./users-roles.md?raw";
import addDataRaw from "./add-data.md?raw";

export interface DocSection {
  id: string;
  title: string;
  image?: string;
  body: string[];
}

/**
 * Parse a simple Markdown string into a DocSection.
 * The first `# Heading` line becomes the title; the remaining
 * blank-line-separated blocks become the body paragraphs.
 * Markdown punctuation escape sequences (e.g. `\_`) are unescaped in the output.
 */
export function parseDocSection(id: string, raw: string): DocSection {
  const lines = raw.trim().split("\n");
  const titleLine = lines.find((l) => l.startsWith("# "));
  const title = titleLine?.slice(2).trim() ?? id;
  const bodyText = lines
    .filter((l) => !l.startsWith("# "))
    .join("\n")
    .trim();
  const body = bodyText
    .split(/\n\n+/)
    .map((p) => p.trim().replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1"))
    .filter(Boolean);
  return { id, title, body };
}

const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

const sections: DocSection[] = [
  { ...parseDocSection("about", aboutRaw), image: logoUrl },
  parseDocSection("connecting", connectingRaw),
  parseDocSection("cors", corsRaw),
  parseDocSection("proxy-mode", proxyModeRaw),
  parseDocSection("dashboard-workflow", dashboardWorkflowRaw),
  parseDocSection("discover-workflow", discoverWorkflowRaw),
  parseDocSection("metrics-workflow", metricsWorkflowRaw),
  parseDocSection("traces-workflow", tracesWorkflowRaw),
  parseDocSection("profiling-workflow", profilingWorkflowRaw),
  parseDocSection("visualizations", visualizationsRaw),
  parseDocSection("keyboard-shortcuts", keyboardShortcutsRaw),
  parseDocSection("console", consoleRaw),
  parseDocSection("data-streams", dataStreamsRaw),
  parseDocSection("chat", chatRaw),
  parseDocSection("llm-settings", llmSettingsRaw),
  parseDocSection("cluster-overview", clusterOverviewRaw),
  parseDocSection("dashboard-management", dashboardManagementRaw),
  parseDocSection("users-roles", usersRolesRaw),
  parseDocSection("add-data", addDataRaw),
];

export default sections;
