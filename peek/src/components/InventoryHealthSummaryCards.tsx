import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import InsightSlot from "./InsightSlot";
import { OverviewInfoCard } from "./OverviewInfoCard";

export interface InventoryHealthSummaryCardsProps {
  /** Label for the total-count card (e.g. "Total Indices", "Total Streams"). */
  totalTitle: string;
  /** Slot ID for the total-count card's InsightSlot wrapper. */
  totalSlotId: string;
  /** Numeric total count. */
  total: number;

  /** Slot ID for the healthy card. */
  healthySlotId: string;
  /** Count of healthy (green) items. */
  healthy: number;

  /** Slot ID for the degraded card. */
  degradedSlotId: string;
  /** Count of degraded (yellow) items. */
  degraded: number;

  /** Slot ID for the unhealthy card. */
  unhealthySlotId: string;
  /** Count of unhealthy (red) items. */
  unhealthy: number;
}

/**
 * Four-card health summary strip shared by inventory pages such as Indices
 * and Data Streams.  Each card is wrapped in an `InsightSlot` so AI insight
 * decorations attach at the correct slot IDs.
 */
export function InventoryHealthSummaryCards({
  totalTitle,
  totalSlotId,
  total,
  healthySlotId,
  healthy,
  degradedSlotId,
  degraded,
  unhealthySlotId,
  unhealthy,
}: InventoryHealthSummaryCardsProps) {
  return (
    <>
      <Box sx={{ flex: 1, minWidth: 100 }}>
        <InsightSlot slotId={totalSlotId}>
          <OverviewInfoCard title={totalTitle}>
            <Typography variant="h5" component="p" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {total}
            </Typography>
          </OverviewInfoCard>
        </InsightSlot>
      </Box>
      <Box sx={{ flex: 1, minWidth: 100 }}>
        <InsightSlot slotId={healthySlotId}>
          <OverviewInfoCard title="Healthy">
            <Typography
              variant="h5"
              component="p"
              sx={{ color: "success.main", fontVariantNumeric: "tabular-nums" }}
            >
              {healthy}
            </Typography>
          </OverviewInfoCard>
        </InsightSlot>
      </Box>
      <Box sx={{ flex: 1, minWidth: 100 }}>
        <InsightSlot slotId={degradedSlotId}>
          <OverviewInfoCard title="Degraded">
            <Typography
              variant="h5"
              component="p"
              sx={{
                color: degraded > 0 ? "warning.main" : "text.primary",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {degraded}
            </Typography>
          </OverviewInfoCard>
        </InsightSlot>
      </Box>
      <Box sx={{ flex: 1, minWidth: 100 }}>
        <InsightSlot slotId={unhealthySlotId}>
          <OverviewInfoCard title="Unhealthy">
            <Typography
              variant="h5"
              component="p"
              sx={{
                color: unhealthy > 0 ? "error.main" : "text.primary",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {unhealthy}
            </Typography>
          </OverviewInfoCard>
        </InsightSlot>
      </Box>
    </>
  );
}
