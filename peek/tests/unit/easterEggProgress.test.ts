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
    expect(isObjectiveComplete(objective, { visitedPages: [], completedObjectiveIds: [] })).toBe(
      false,
    );
  });

  it("unlocks quests sequentially as prerequisites complete", () => {
    // Complete quest 1 (dashboards, discover, clusterOverview)
    // and quest 2 (logs, explore, hosts)
    const progress = buildQuestProgress(EASTER_EGG_QUESTS, {
      visitedPages: ["dashboards", "discover", "clusterOverview", "logs", "explore", "hosts"],
      completedObjectiveIds: [],
    });

    expect(progress[0].complete).toBe(true);
    expect(progress[1].unlocked).toBe(true);
    expect(progress[1].complete).toBe(true);
    expect(progress[2].unlocked).toBe(true);
    expect(progress[2].complete).toBe(false);
  });

  it("completes all quests when all pages are visited", () => {
    const progress = buildQuestProgress(EASTER_EGG_QUESTS, {
      visitedPages: [
        "dashboards",
        "discover",
        "clusterOverview",
        "logs",
        "explore",
        "hosts",
        "traces",
        "services",
        "console",
      ],
      completedObjectiveIds: [],
    });

    expect(progress.every((p) => p.complete)).toBe(true);
    expect(progress.every((p) => p.unlocked)).toBe(true);
  });

  it("locks quest 2 when quest 1 is incomplete", () => {
    const progress = buildQuestProgress(EASTER_EGG_QUESTS, {
      visitedPages: ["dashboards", "discover"],
      completedObjectiveIds: [],
    });

    expect(progress[0].complete).toBe(false);
    expect(progress[0].completedCount).toBe(2);
    expect(progress[1].unlocked).toBe(false);
  });
});
