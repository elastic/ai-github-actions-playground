import { describe, it, expect } from "vitest";

import { buildQuestProgress, isObjectiveComplete } from "../../src/features/easterEgg/progress";
import { EASTER_EGG_QUESTS } from "../../src/features/easterEgg/quests";

describe("easter egg quest progress", () => {
  it("marks visitPage objectives complete based on visited pages", () => {
    const objective = EASTER_EGG_QUESTS[0].objectives.find(
      (item) => item.id === "visit-dashboards",
    );
    expect(objective).toBeDefined();
    if (!objective) return;

    expect(
      isObjectiveComplete(objective, { visitedPages: ["dashboards"], completedObjectiveIds: [] }),
    ).toBe(true);
  });

  it("marks confirmAction objectives complete only when explicitly confirmed", () => {
    const objective = EASTER_EGG_QUESTS[0].objectives.find(
      (item) => item.id === "confirm-first-query",
    );
    expect(objective).toBeDefined();
    if (!objective) return;

    expect(
      isObjectiveComplete(objective, {
        visitedPages: ["discover"],
        completedObjectiveIds: ["confirm-first-query"],
      }),
    ).toBe(true);
    expect(
      isObjectiveComplete(objective, {
        visitedPages: ["discover"],
        completedObjectiveIds: [],
      }),
    ).toBe(false);
  });

  it("unlocks quests sequentially as prerequisites complete", () => {
    const progress = buildQuestProgress(EASTER_EGG_QUESTS, {
      visitedPages: ["dashboards", "discover", "logs", "explore"],
      completedObjectiveIds: ["confirm-first-query", "confirm-log-filters"],
    });

    expect(progress[0].complete).toBe(true);
    expect(progress[1].unlocked).toBe(true);
    expect(progress[1].complete).toBe(true);
    expect(progress[2].unlocked).toBe(true);
    expect(progress[2].complete).toBe(false);
  });
});
