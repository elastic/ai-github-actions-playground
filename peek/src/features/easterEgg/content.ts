import type { RewardMoment } from "./types";

export const EASTER_EGG_MODE_BLURB =
  "Enable an optional isometric story overlay that layers quests and narrative rewards over existing observability workflows.";

export const REWARD_MOMENTS: RewardMoment[] = [
  {
    id: "scout-badge",
    title: "Scout Badge Earned!",
    emoji: "🏅",
    copy: "You've charted the core territory — dashboards, queries, and cluster health are now in your toolkit.",
  },
  {
    id: "signal-keeper-banner",
    title: "Signal Keeper!",
    emoji: "📡",
    copy: "You can read the signals now. Logs, metrics, and hosts have no secrets from you.",
  },
  {
    id: "navigator-sigil",
    title: "Navigator Sigil!",
    emoji: "🧭",
    copy: "You've mastered the full observability stack — traces, services, and the raw API. The expedition is complete!",
  },
];

export const REWARD_BY_ID = new Map(REWARD_MOMENTS.map((reward) => [reward.id, reward]));
