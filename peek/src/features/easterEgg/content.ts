import type { RewardMoment } from "./types";

export const EASTER_EGG_MODE_BLURB =
  "Enable an optional isometric story overlay that layers quests and narrative rewards over existing observability workflows.";

export const REWARD_MOMENTS: RewardMoment[] = [
  {
    id: "scout-badge",
    title: "Scout Badge Unlocked",
    copy: "You mapped your first route between Dashboard Harbor and Query Square.",
  },
  {
    id: "signal-keeper-banner",
    title: "Signal Keeper Banner",
    copy: "Your party stabilized noisy logs and earned the village's trust.",
  },
  {
    id: "navigator-sigil",
    title: "Navigator Sigil",
    copy: "You completed the phase three arc and unlocked the Guild Hall story marker.",
  },
];

export const REWARD_BY_ID = new Map(REWARD_MOMENTS.map((reward) => [reward.id, reward]));
