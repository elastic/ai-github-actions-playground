import { useMemo } from "react";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {
  AWS_DEPLOY_TARGETS,
  AWS_DEPLOY_TARGET_BY_ID,
} from "../../../services/addData/awsDeployCatalog";
import type { AwsDeployTarget } from "../../../services/addData/awsDeployCatalog";

import ExpandableAlternatives from "./ExpandableAlternatives";

export interface AwsDeployConfigureProps {
  selectedTarget: AwsDeployTarget | null;
  onSelectTarget: (target: AwsDeployTarget) => void;
}

interface TargetCardProps {
  target: AwsDeployTarget;
  isSelected: boolean;
  onSelect: () => void;
  recommended?: boolean;
}

function TargetCard({ target, isSelected, onSelect, recommended }: TargetCardProps) {
  return (
    <ButtonBase onClick={onSelect} sx={{ display: "block", borderRadius: 1, textAlign: "left" }}>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? "primary.main" : undefined,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {target.label}
          </Typography>
          {recommended && <Chip size="small" color="primary" label="Recommended" />}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {target.summary}
        </Typography>
      </Paper>
    </ButtonBase>
  );
}

export default function AwsDeployConfigure({
  selectedTarget,
  onSelectTarget,
}: AwsDeployConfigureProps) {
  const firehoseTarget = useMemo(() => AWS_DEPLOY_TARGET_BY_ID.get("firehose") ?? null, []);
  const advancedTargets = useMemo(
    () => AWS_DEPLOY_TARGETS.filter((target) => target.targetId !== "firehose"),
    [],
  );

  if (!firehoseTarget) return null;

  return (
    <Stack spacing={1}>
      <TargetCard
        target={firehoseTarget}
        isSelected={selectedTarget?.targetId === firehoseTarget.targetId}
        onSelect={() => onSelectTarget(firehoseTarget)}
        recommended
      />

      {advancedTargets.length > 0 && (
        <ExpandableAlternatives
          idPrefix="aws"
          label="Show other options"
          expandedLabel="Hide other options"
        >
          {advancedTargets.map((target) => (
            <TargetCard
              key={target.targetId}
              target={target}
              isSelected={selectedTarget?.targetId === target.targetId}
              onSelect={() => onSelectTarget(target)}
            />
          ))}
        </ExpandableAlternatives>
      )}
    </Stack>
  );
}
