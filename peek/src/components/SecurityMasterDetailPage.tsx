import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import type { SxProps, Theme } from "@mui/material/styles";

import ContentSkeleton from "./ContentSkeleton";
import PageContainer from "./PageContainer";
import PageHeaderSection from "./PageHeaderSection";

/**
 * Shared sx for ListItemButton inside security master-detail list panes.
 * Adds a left accent rail on the selected row, matching the sidebar's
 * active-item pattern from the design language.
 */
export const MASTER_LIST_ITEM_SX: SxProps<Theme> = {
  position: "relative",
  borderRadius: 0.5,
  mx: 0.5,
  "&.Mui-selected": {
    bgcolor: "action.selected",
    "&::before": {
      position: "absolute",
      top: "20%",
      bottom: "20%",
      left: 0,
      width: 3,
      borderRadius: 1,
      bgcolor: "primary.main",
      content: '""',
    },
    "&:hover": { bgcolor: "action.selected" },
  },
};

interface SecurityMasterDetailPageProps {
  title: string;
  actions: ReactNode;
  alerts?: ReactNode;
  showLoadingSkeleton?: boolean;
  masterPane: ReactNode;
  detailPane: ReactNode;
}

export default function SecurityMasterDetailPage({
  title,
  actions,
  alerts,
  showLoadingSkeleton = false,
  masterPane,
  detailPane,
}: SecurityMasterDetailPageProps) {
  return (
    <PageContainer>
      <PageHeaderSection title={title} actions={actions} />

      {alerts}

      {showLoadingSkeleton ? (
        <Paper variant="outlined" sx={{ flex: 1, p: 1.5 }}>
          <ContentSkeleton variant="table" />
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
          <Paper
            variant="outlined"
            sx={{
              display: "flex",
              flexShrink: 0,
              flexDirection: "column",
              width: 320,
              minHeight: 0,
            }}
          >
            {masterPane}
          </Paper>

          <Paper
            variant="outlined"
            sx={{ display: "flex", flex: 1, flexDirection: "column", gap: 1, minHeight: 0, p: 1.5 }}
          >
            {detailPane}
          </Paper>
        </Box>
      )}
    </PageContainer>
  );
}
