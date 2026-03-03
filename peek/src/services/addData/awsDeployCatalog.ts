/**
 * AWS Cloud Deploy targets. Each target represents an AWS monitoring setup
 * that can be deployed via CloudFormation Quick Create.
 */
export interface AwsDeployParameter {
  readonly key: string;
  readonly label: string;
  readonly description: string;
}

export interface AwsDeployTarget {
  readonly targetId: string;
  readonly label: string;
  readonly summary: string;
  readonly cloudFormationTemplateUrl: string;
  readonly parameters: readonly AwsDeployParameter[];
}

/**
 * Build a CloudFormation Quick Create URL with pre-populated parameters.
 */
export function buildCloudFormationQuickCreateUrl(
  target: AwsDeployTarget,
  values: Record<string, string>,
): string {
  const params = new URLSearchParams();
  params.set("templateURL", target.cloudFormationTemplateUrl);
  params.set("stackName", `elastic-${target.targetId}-forwarder`);
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(`param_${key}`, value);
  }
  return `https://console.aws.amazon.com/cloudformation/home#/stacks/quickcreate?${params.toString()}`;
}

export const AWS_DEPLOY_TARGETS: readonly AwsDeployTarget[] = [
  {
    targetId: "firehose",
    label: "Amazon Data Firehose",
    summary: "Stream CloudWatch logs and metrics directly to Elastic via Firehose delivery stream.",
    cloudFormationTemplateUrl:
      "https://elastic-cloudformation-templates.s3.amazonaws.com/firehose/elastic-firehose.yaml",
    parameters: [
      {
        key: "ElasticsearchEndpoint",
        label: "Elasticsearch endpoint",
        description: "Your Elastic Cloud or self-managed Elasticsearch URL.",
      },
      {
        key: "ApiKey",
        label: "API key",
        description: "Base64-encoded API key for authentication.",
      },
    ],
  },
  {
    targetId: "cloud-forwarder",
    label: "EDOT Cloud Forwarder",
    summary:
      "Deploy a serverless OTel Collector on AWS Lambda to forward logs, metrics, and traces.",
    cloudFormationTemplateUrl:
      "https://elastic-cloudformation-templates.s3.amazonaws.com/forwarder/elastic-forwarder.yaml",
    parameters: [
      {
        key: "ElasticsearchEndpoint",
        label: "Elasticsearch endpoint",
        description: "Your Elastic Cloud or self-managed Elasticsearch URL.",
      },
      {
        key: "ApiKey",
        label: "API key",
        description: "Base64-encoded API key for authentication.",
      },
    ],
  },
];

export const AWS_DEPLOY_TARGET_BY_ID: ReadonlyMap<string, AwsDeployTarget> = new Map(
  AWS_DEPLOY_TARGETS.map((t) => [t.targetId, t]),
);
