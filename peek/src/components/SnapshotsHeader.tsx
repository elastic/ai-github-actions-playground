import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";

import PageHeader from "./PageHeader";
import { SnapshotKpiCards, PolicyKpiCards } from "./snapshots/SnapshotKpiCards";

type SnapshotTab = "snapshots" | "policies" | "repositories";

interface SnapshotsHeaderProps {
  activeTab: SnapshotTab;
  loading: boolean;
  snapshotCount: number;
  successCount: number;
  failedCount: number;
  inProgressCount: number;
  policyCount: number;
  totalTaken: number;
  totalFailed: number;
  retentionRuns: number;
  onRefresh: () => void;
}

export default function SnapshotsHeader({
  activeTab,
  loading,
  snapshotCount,
  successCount,
  failedCount,
  inProgressCount,
  policyCount,
  totalTaken,
  totalFailed,
  retentionRuns,
  onRefresh,
}: SnapshotsHeaderProps) {
  return (
    <>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Snapshots & SLM"
          actions={
            <Button
              size="small"
              variant="outlined"
              onClick={onRefresh}
              aria-label={loading ? "Refreshing snapshot data" : "Refresh snapshot data"}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />
      </Paper>
      {activeTab === "snapshots" && (
        <SnapshotKpiCards
          total={snapshotCount}
          successCount={successCount}
          failedCount={failedCount}
          inProgressCount={inProgressCount}
        />
      )}
      {activeTab === "policies" && (
        <PolicyKpiCards
          policyCount={policyCount}
          totalTaken={totalTaken}
          totalFailed={totalFailed}
          retentionRuns={retentionRuns}
        />
      )}
    </>
  );
}
