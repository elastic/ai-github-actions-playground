import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";

import ContentSkeleton from "./ContentSkeleton";
import PageContainer from "./PageContainer";
import PageHeaderSection from "./PageHeaderSection";

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
