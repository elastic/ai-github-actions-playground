import { useMemo } from "react";
import Button from "@mui/material/Button";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { buildCloudFormationQuickCreateUrl } from "../../../services/addData/awsDeployCatalog";
import type { AwsDeployTarget } from "../../../services/addData/awsDeployCatalog";

export interface AwsDeployInstallProps {
  target: AwsDeployTarget;
  esUrl: string;
  apiKey: string;
}

export default function AwsDeployInstall({ target, esUrl, apiKey }: AwsDeployInstallProps) {
  const quickCreateUrl = useMemo(
    () =>
      buildCloudFormationQuickCreateUrl(target, {
        ElasticsearchEndpoint: esUrl,
        ApiKey: apiKey,
      }),
    [target, esUrl, apiKey],
  );

  return (
    <>
      <Typography variant="body2" color="text.secondary">
        Click the button below to open the CloudFormation Quick Create page in AWS. The stack name
        and Elasticsearch endpoint will be pre-filled. You will need to enter the API key manually
        in the AWS console.
      </Typography>

      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {target.label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {target.summary}
        </Typography>
        <Button
          variant="contained"
          href={quickCreateUrl}
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<OpenInNewIcon />}
          sx={{ alignSelf: "flex-start" }}
        >
          Launch Stack in AWS Console
        </Button>
      </Stack>
    </>
  );
}
