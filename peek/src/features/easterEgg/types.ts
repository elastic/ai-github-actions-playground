import type { PageId } from "../../routes/paths";

export interface WorldLocation {
  id: string;
  name: string;
  page: PageId;
  settlement: "town" | "village" | "outpost";
  description: string;
  questHint?: string;
  unlockAfterQuestIds?: string[];
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
  copy: string;
}
