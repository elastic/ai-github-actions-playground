import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";

import { formatTimestamp } from "../../utils/formatDate";

import type { InvestigateTab, TimelineEvent } from "./investigateUtils";

interface InvestigateTimelineTableProps {
  events: TimelineEvent[];
  activeTab: InvestigateTab;
}

/** Return the contextual column header and value for the "related entity" column. */
function relatedColumn(
  activeTab: InvestigateTab,
  event: TimelineEvent,
): { header: string; value: string } {
  switch (activeTab) {
    case "user":
      return { header: "Host", value: event.hostName };
    case "host":
      return { header: "User", value: event.userName };
    case "ip":
      return { header: "Host", value: event.hostName };
    case "domain":
      return { header: "Host", value: event.hostName };
    case "file":
      return { header: "User", value: event.userName };
  }
}

export default function InvestigateTimelineTable({
  events,
  activeTab,
}: InvestigateTimelineTableProps) {
  const related = relatedColumn(activeTab, events[0] ?? ({} as TimelineEvent));
  return (
    <Paper variant="outlined" sx={{ p: 0 }}>
      <Box
        component="table"
        sx={{
          width: "100%",
          borderCollapse: "collapse",
          "& th": {
            position: "sticky",
            zIndex: 1,
            top: 0,
            bgcolor: "action.hover",
            fontWeight: 600,
          },
          "& th, & td": {
            verticalAlign: "top",
            py: 1,
            px: 1,
            borderBottom: 1,
            borderColor: "divider",
            textAlign: "left",
            fontSize: "0.8125rem",
          },
        }}
      >
        <thead>
          <tr>
            <Box component="th">Timestamp</Box>
            <Box component="th">Data Source</Box>
            <Box component="th">Category</Box>
            <Box component="th">Action</Box>
            <Box component="th">Outcome</Box>
            <Box component="th">{related.header}</Box>
            <Box component="th">Source IP</Box>
            <Box component="th">Message</Box>
          </tr>
        </thead>
        <tbody>
          {events.map((event, idx) => {
            const cell = relatedColumn(activeTab, event);
            return (
              <tr key={`${event.timestamp}-${event.dataSource}-${idx}`}>
                <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                  {formatTimestamp(event.timestamp)}
                </Box>
                <Box component="td">
                  <Chip
                    size="small"
                    label={event.dataSource || "—"}
                    variant="outlined"
                    sx={{ maxWidth: 200, fontSize: "0.75rem" }}
                  />
                </Box>
                <Box component="td">{event.category || "—"}</Box>
                <Box component="td">{event.action || "—"}</Box>
                <Box component="td">{event.outcome || "—"}</Box>
                <Box component="td">{cell.value || "—"}</Box>
                <Box component="td">{event.sourceIp || "—"}</Box>
                <Box
                  component="td"
                  sx={{
                    maxWidth: 400,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {event.message || "—"}
                </Box>
              </tr>
            );
          })}
        </tbody>
      </Box>
    </Paper>
  );
}
