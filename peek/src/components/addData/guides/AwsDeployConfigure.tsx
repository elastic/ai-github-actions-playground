import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { AWS_DEPLOY_TARGETS } from "../../../services/addData/awsDeployCatalog";
import type { AwsDeployTarget } from "../../../services/addData/awsDeployCatalog";

export interface AwsDeployConfigureProps {
  selectedTarget: AwsDeployTarget | null;
  onSelectTarget: (target: AwsDeployTarget) => void;
}

export default function AwsDeployConfigure({
  selectedTarget,
  onSelectTarget,
}: AwsDeployConfigureProps) {
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Select an AWS deployment method
      </Typography>
      <Stack spacing={1}>
        {AWS_DEPLOY_TARGETS.map((target) => (
          <Paper
            key={target.targetId}
            variant="outlined"
            onClick={() => onSelectTarget(target)}
            sx={{
              p: 1.5,
              borderWidth: selectedTarget?.targetId === target.targetId ? 2 : 1,
              borderColor:
                selectedTarget?.targetId === target.targetId ? "primary.main" : undefined,
              cursor: "pointer",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {target.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {target.summary}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </>
  );
}
