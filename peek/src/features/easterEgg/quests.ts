import type { EasterEggQuest } from "./types";

export const EASTER_EGG_QUESTS: EasterEggQuest[] = [
  {
    id: "scout-the-frontier",
    title: "Scout the Frontier",
    description: "Learn the terrain by visiting the command and query hubs.",
    unlockAfterQuestIds: [],
    rewardId: "scout-badge",
    objectives: [
      {
        id: "visit-dashboards",
        title: "Visit Sunset Harbor",
        kind: "visitPage",
        page: "dashboards",
        description: "Open Dashboards and inspect your command board.",
      },
      {
        id: "visit-query-square",
        title: "Visit Query Square",
        kind: "visitPage",
        page: "discover",
        description: "Open Query Lab and explore an ES|QL route.",
      },
      {
        id: "confirm-first-query",
        title: "Confirm a first query run",
        kind: "confirmAction",
        page: "discover",
        description: "After running a starter query, mark this objective complete.",
      },
    ],
  },
  {
    id: "stabilize-the-signal-mill",
    title: "Stabilize the Signal Mill",
    description: "Investigate log flow and tune metrics from the ridge.",
    unlockAfterQuestIds: ["scout-the-frontier"],
    rewardId: "signal-keeper-banner",
    objectives: [
      {
        id: "visit-logs",
        title: "Visit Signal Mill",
        kind: "visitPage",
        page: "logs",
        description: "Open Logs and inspect signal flow.",
      },
      {
        id: "confirm-log-filters",
        title: "Confirm log filters applied",
        kind: "confirmAction",
        page: "logs",
        description: "Apply filters in Logs, then mark this objective complete.",
      },
      {
        id: "visit-metrics",
        title: "Visit Watchtower Ridge",
        kind: "visitPage",
        page: "explore",
        description: "Open Metrics and compare a key chart over time.",
      },
    ],
  },
  {
    id: "open-the-trace-grove",
    title: "Open the Trace Grove",
    description: "Complete a cross-signal investigation and unlock the guild chapter.",
    unlockAfterQuestIds: ["stabilize-the-signal-mill"],
    rewardId: "navigator-sigil",
    objectives: [
      {
        id: "visit-traces",
        title: "Visit Trace Grove",
        kind: "visitPage",
        page: "traces",
        description: "Open Traces and inspect a request path.",
      },
      {
        id: "confirm-trace-pivot",
        title: "Confirm trace pivot completed",
        kind: "confirmAction",
        page: "traces",
        description: "Pivot through a trace workflow, then confirm completion.",
      },
      {
        id: "visit-services",
        title: "Visit Guild Hall",
        kind: "visitPage",
        page: "services",
        description: "Open Services to review downstream impact.",
      },
    ],
  },
];
