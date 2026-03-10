import type { EasterEggQuest } from "./types";

export const EASTER_EGG_QUESTS: EasterEggQuest[] = [
  {
    id: "scout-the-frontier",
    title: "Scout the Frontier",
    description:
      "Every great expedition starts with a map. Visit the command board and the query lab to orient yourself.",
    unlockAfterQuestIds: [],
    rewardId: "scout-badge",
    objectives: [
      {
        id: "visit-dashboards",
        title: "Dock at Sunset Harbor",
        kind: "visitPage",
        page: "dashboards",
        description:
          "Dashboards are your command board — pin charts, track KPIs, and stay oriented.",
      },
      {
        id: "visit-query-square",
        title: "Climb to Query Square",
        kind: "visitPage",
        page: "discover",
        description:
          "The Query Lab lets you write ES|QL queries to slice and explore your data interactively.",
      },
      {
        id: "visit-overview-spire",
        title: "Ascend the Overview Spire",
        kind: "visitPage",
        page: "clusterOverview",
        description:
          "The Cluster Overview gives you a bird's-eye view of node health, shard allocation, and capacity.",
      },
    ],
  },
  {
    id: "stabilize-the-signal-mill",
    title: "Stabilize the Signal Mill",
    description:
      "Signals are flowing in from every direction. Learn to read logs and scan metrics before the storm hits.",
    unlockAfterQuestIds: ["scout-the-frontier"],
    rewardId: "signal-keeper-banner",
    objectives: [
      {
        id: "visit-logs",
        title: "Enter the Signal Mill",
        kind: "visitPage",
        page: "logs",
        description: "The Logs view lets you filter, search, and tail log streams in real time.",
      },
      {
        id: "visit-metrics",
        title: "Scale Watchtower Ridge",
        kind: "visitPage",
        page: "explore",
        description:
          "Metrics Explorer lets you chart any metric, compare hosts, and spot anomalous drift.",
      },
      {
        id: "visit-hosts",
        title: "Survey the Server Farm",
        kind: "visitPage",
        page: "hosts",
        description:
          "The Hosts view shows CPU, memory, disk, and network stats for every machine in your fleet.",
      },
    ],
  },
  {
    id: "open-the-trace-grove",
    title: "Open the Trace Grove",
    description:
      "Traces tell the story of a single request across many services. Follow the path and find the bottleneck.",
    unlockAfterQuestIds: ["stabilize-the-signal-mill"],
    rewardId: "navigator-sigil",
    objectives: [
      {
        id: "visit-traces",
        title: "Enter the Trace Grove",
        kind: "visitPage",
        page: "traces",
        description:
          "Distributed traces show latency waterfalls — see exactly where time is spent across services.",
      },
      {
        id: "visit-services",
        title: "Report to the Guild Hall",
        kind: "visitPage",
        page: "services",
        description:
          "The Services view maps dependencies, throughput, and error rates for every instrumented service.",
      },
      {
        id: "visit-console",
        title: "Enter the Terminal Tower",
        kind: "visitPage",
        page: "console",
        description:
          "The Dev Console gives you raw access to the Elasticsearch API — run any request, inspect any response.",
      },
    ],
  },
];
