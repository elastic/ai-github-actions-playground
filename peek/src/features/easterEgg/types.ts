import type { PageId } from "../../routes/paths";

export interface WorldLocation {
  id: string;
  name: string;
  page: PageId;
  settlement: "town" | "village" | "outpost";
  description: string;
  questHint?: string;
  unlockAfterQuestIds?: string[];
  /** Emoji or text icon for the building on the isometric map. */
  emoji: string;
  /** X position on the map grid (0–100 percentage). */
  mapX: number;
  /** Y position on the map grid (0–100 percentage). */
  mapY: number;
}

export interface QuestObjective {
  id: string;
  title: string;
  kind: "visitPage" | "confirmAction";
  page?: PageId;
  description: string;
}

export interface EasterEggQuest {
  id: string;
  title: string;
  description: string;
  unlockAfterQuestIds: string[];
  objectives: QuestObjective[];
  rewardId: string;
}

export interface RewardMoment {
  id: string;
  title: string;
  emoji: string;
  copy: string;
}
