import ButtonBase from "@mui/material/ButtonBase";
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
        {AWS_DEPLOY_TARGETS.map((target) => {
          const isSelected = selectedTarget?.targetId === target.targetId;
          return (
            <ButtonBase
              key={target.targetId}
              onClick={() => onSelectTarget(target)}
              sx={{ display: "block", borderRadius: 1, textAlign: "left" }}
            >
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? "primary.main" : undefined,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {target.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {target.summary}
                </Typography>
              </Paper>
            </ButtonBase>
          );
        })}
      </Stack>
    </>
  );
}
