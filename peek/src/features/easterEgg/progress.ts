import type { PageId } from "../../routes/paths";

import type { EasterEggQuest, QuestObjective } from "./types";

export interface QuestProgressInput {
  visitedPages: readonly PageId[];
  completedObjectiveIds: readonly string[];
}

export interface QuestProgress {
  quest: EasterEggQuest;
  unlocked: boolean;
  complete: boolean;
  completedCount: number;
  totalCount: number;
  completedObjectiveIds: string[];
}

export function isObjectiveComplete(objective: QuestObjective, state: QuestProgressInput): boolean {
  if (objective.kind === "visitPage") {
    return Boolean(objective.page && state.visitedPages.includes(objective.page));
  }
  return state.completedObjectiveIds.includes(objective.id);
}

export function isQuestUnlocked(
  quest: EasterEggQuest,
  completedQuestIds: readonly string[],
): boolean {
  return quest.unlockAfterQuestIds.every((questId) => completedQuestIds.includes(questId));
}

export function buildQuestProgress(
  quests: readonly EasterEggQuest[],
  state: QuestProgressInput,
): QuestProgress[] {
  // First pass: determine which quests are complete
  const completedQuestIds = quests
    .filter((quest) => {
      const done = quest.objectives.filter((o) => isObjectiveComplete(o, state));
      return quest.objectives.length > 0 && done.length === quest.objectives.length;
    })
    .map((q) => q.id);

  // Second pass: build progress with stable completedQuestIds
  const progress: QuestProgress[] = [];

  for (const quest of quests) {
    const unlocked = isQuestUnlocked(quest, completedQuestIds);
    const completedObjectiveIds = quest.objectives
      .filter((objective) => isObjectiveComplete(objective, state))
      .map((objective) => objective.id);
    const complete =
      quest.objectives.length > 0 && completedObjectiveIds.length === quest.objectives.length;
    progress.push({
      quest,
      unlocked,
      complete,
      completedCount: completedObjectiveIds.length,
      totalCount: quest.objectives.length,
      completedObjectiveIds,
    });
  }

  return progress;
}
