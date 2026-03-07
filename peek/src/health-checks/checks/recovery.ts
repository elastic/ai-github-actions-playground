import type { HealthCheckDefinition } from "../types";

const ACTIVE_RECOVERY_HIGH = 5;
const SLOW_RECOVERY_STAGE_HIGH = 3;

function unknownRecoveryDataResult() {
  return {
    status: "unknown" as const,
    summary: "Recovery data unavailable.",
    recommendation: "Ensure recovery data is collected and verify cluster permissions.",
  };
}

export const recoveryChecks: HealthCheckDefinition[] = [
  // #29
  {
    id: "recovery.active.high",
    domain: "shards",
    title: "Active recoveries high",
    description: `Warns when >= ${ACTIVE_RECOVERY_HIGH} shard recoveries are active.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["recoveryCore"],
    evaluate: (snapshot) => {
      const recoveryData = snapshot.data.recoveryCore;
      if (!recoveryData) return unknownRecoveryDataResult();
      const recovery = recoveryData.recovery ?? {};
      let activeCount = 0;
      for (const indexRecovery of Object.values(recovery)) {
        const shards = indexRecovery.shards ?? [];
        activeCount += shards.filter((s) => s.stage && s.stage !== "DONE").length;
      }
      if (activeCount >= ACTIVE_RECOVERY_HIGH) {
        return {
          status: "warn",
          summary: `${activeCount} active shard recoveries.`,
          observed: { activeCount },
          recommendation: "Many concurrent recoveries may impact cluster performance.",
        };
      }
      return { status: "pass", summary: `Active recoveries (${activeCount}) within threshold.` };
    },
  },
  // #30
  {
    id: "recovery.stage.long_tail",
    domain: "shards",
    title: "Recovery stages long tail",
    description: "Warns when many recovering shards are stuck in translog or finalize stage.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["recoveryCore"],
    evaluate: (snapshot) => {
      const recoveryData = snapshot.data.recoveryCore;
      if (!recoveryData) return unknownRecoveryDataResult();
      const recovery = recoveryData.recovery ?? {};
      let slowStageCount = 0;
      for (const indexRecovery of Object.values(recovery)) {
        const shards = indexRecovery.shards ?? [];
        slowStageCount += shards.filter((s) => {
          const stage = (s.stage ?? "").toUpperCase();
          return stage === "TRANSLOG" || stage === "FINALIZE";
        }).length;
      }
      if (slowStageCount >= SLOW_RECOVERY_STAGE_HIGH) {
        return {
          status: "warn",
          summary: `${slowStageCount} shards in translog/finalize recovery stage.`,
          observed: { slowStageCount },
          recommendation: "Shards in translog replay or finalize stages may indicate slow I/O.",
        };
      }
      return { status: "pass", summary: "No long-tail recovery stages detected." };
    },
  },
];
