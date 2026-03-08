import Paper from "@mui/material/Paper";

import PageHeader from "./PageHeader";
import type { PageHeaderProps } from "./PageHeader";

export default function PageHeaderSection(props: PageHeaderProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <PageHeader {...props} />
    </Paper>
  );
}
