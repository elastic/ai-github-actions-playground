import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { buildCloudFormationQuickCreateUrl } from "../../../services/addData/awsDeployCatalog";
import type { AwsDeployTarget } from "../../../services/addData/awsDeployCatalog";
import { copyToClipboard } from "../../../utils/copyToClipboard";
import { useCopyFeedbackTimeout } from "../../../hooks/useCopyFeedbackTimeout";

import { CODE_BLOCK_SX } from "./sharedStyles";

export interface AwsDeployInstallProps {
  target: AwsDeployTarget;
  esUrl: string;
  apiKey: string;
  onLaunchStack: () => void;
}

export default function AwsDeployInstall({
  target,
  esUrl,
  apiKey,
  onLaunchStack,
}: AwsDeployInstallProps) {
  const [activeTab, setActiveTab] = useState<"quick" | "manual">("quick");
  const [copied, setCopied] = useState(false);
  const scheduleReset = useCopyFeedbackTimeout(() => setCopied(false));
  const quickCreateUrl = useMemo(
    () =>
      buildCloudFormationQuickCreateUrl(target, {
        ElasticsearchEndpoint: esUrl,
        ApiKey: apiKey,
      }),
    [target, esUrl, apiKey],
  );
  const stackName = `elastic-${target.targetId}-forwarder`;
  const cloudShellUrl = "https://console.aws.amazon.com/cloudshell/home";
  const manualDeployCommand = useMemo(
    () => `aws cloudformation deploy \\
  --stack-name ${stackName} \\
  --template-url ${target.cloudFormationTemplateUrl} \\
  --capabilities CAPABILITY_NAMED_IAM \\
  --parameter-overrides \\
    ElasticsearchEndpoint=${esUrl} \\
    ApiKey=${apiKey}`,
    [apiKey, esUrl, stackName, target.cloudFormationTemplateUrl],
  );

  return (
    <Stack spacing={1.5}>
      <Tabs value={activeTab} onChange={(_e, value: "quick" | "manual") => setActiveTab(value)}>
        <Tab label="Launch stack" value="quick" />
        <Tab label="Manual CLI" value="manual" />
      </Tabs>

      {activeTab === "quick" ? (
        <>
          <Typography variant="body2" color="text.secondary">
            Open CloudFormation Quick Create in AWS. The stack name, Elasticsearch endpoint, and API
            key parameters will be pre-filled.
          </Typography>
          <Button
            variant="contained"
            href={quickCreateUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon />}
            sx={{ alignSelf: "flex-start" }}
            onClick={onLaunchStack}
          >
            Launch stack in AWS Console
          </Button>
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">
            Deploy manually with AWS CLI. Run the command below in CloudShell or your local shell.
          </Typography>
          <Box component="pre" sx={CODE_BLOCK_SX}>
            {manualDeployCommand}
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignSelf: "flex-start" }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                onLaunchStack();
                void copyToClipboard(manualDeployCommand).then((ok) => {
                  if (!ok) return;
                  setCopied(true);
                  scheduleReset();
                });
              }}
            >
              {copied ? "Copied!" : "Copy CLI command"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              href={cloudShellUrl}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon fontSize="small" />}
            >
              Open CloudShell
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}
