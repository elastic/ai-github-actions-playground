import type { WorldLocation } from "./types";

export const WORLD_MAP: WorldLocation[] = [
  {
    id: "sunset-harbor",
    name: "Sunset Harbor",
    page: "dashboards",
    settlement: "town",
    description: "A bustling harbor where explorers pin dashboards and compare signals.",
    questHint: "Start your journey by checking your command board.",
  },
  {
    id: "query-square",
    name: "Query Square",
    page: "discover",
    settlement: "town",
    description: "A market of clues where ES|QL scrolls reveal hidden patterns.",
    questHint: "Experiment with a query and refine it before heading out.",
  },
  {
    id: "signal-mill",
    name: "Signal Mill",
    page: "logs",
    settlement: "village",
    description: "A riverside mill where log streams are filtered and sorted.",
    questHint: "Tune filters to isolate the story inside your logs.",
  },
  {
    id: "watchtower-ridge",
    name: "Watchtower Ridge",
    page: "explore",
    settlement: "outpost",
    description: "A high ridge for scanning metric storms and spotting drift.",
    questHint: "Adjust views and watch changing trends over time.",
  },
  {
    id: "trace-grove",
    name: "Trace Grove",
    page: "traces",
    settlement: "village",
    description: "A grove where trace routes form bright paths through the woods.",
    questHint: "Follow one request path to find service bottlenecks.",
    unlockAfterQuestIds: ["scout-the-frontier"],
  },
  {
    id: "guild-hall",
    name: "Guild Hall",
    page: "services",
    settlement: "town",
    description: "A meeting hall where service owners coordinate reliability work.",
    questHint: "Visit after your first expedition to unlock guild rewards.",
    unlockAfterQuestIds: ["scout-the-frontier", "stabilize-the-signal-mill"],
  },
];

export const WORLD_MAP_BY_PAGE = new Map(WORLD_MAP.map((location) => [location.page, location]));
