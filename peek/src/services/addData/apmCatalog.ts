/**
 * APM language definitions for the APM instrumentation guide type.
 * Each language provides install and initialization snippets with
 * `{{endpoint}}` and `{{apiKey}}` placeholders.
 */
export interface ApmLanguageDefinition {
  readonly languageId: string;
  readonly label: string;
  readonly installCommand: string;
  readonly initSnippet: string;
  readonly docsUrl: string;
}

export const APM_LANGUAGE_CATALOG: readonly ApmLanguageDefinition[] = [
  {
    languageId: "java",
    label: "Java",
    installCommand: `# Download the Elastic APM Java agent
curl -L -o elastic-apm-agent.jar \\
  'https://oss.sonatype.org/service/local/artifact/maven/redirect?r=releases&g=co.elastic.apm&a=elastic-apm-agent&v=LATEST'`,
    initSnippet: `# Add JVM flags to your application startup
java -javaagent:elastic-apm-agent.jar \\
  -Delastic.apm.service_name=my-service \\
  -Delastic.apm.server_urls={{endpoint}} \\
  -Delastic.apm.secret_token={{apiKey}} \\
  -jar my-app.jar`,
    docsUrl: "https://www.elastic.co/docs/apm/agents/java/current",
  },
  {
    languageId: "python",
    label: "Python",
    installCommand: "pip install elastic-apm",
    initSnippet: `import elasticapm

# Initialize the APM client
client = elasticapm.Client(
    service_name="my-service",
    server_url="{{endpoint}}",
    secret_token="{{apiKey}}",
)`,
    docsUrl: "https://www.elastic.co/docs/apm/agents/python/current",
  },
  {
    languageId: "nodejs",
    label: "Node.js",
    installCommand: "npm install elastic-apm-node",
    initSnippet: `// Add at the very top of your entry file (before any imports)
const apm = require('elastic-apm-node').start({
  serviceName: 'my-service',
  serverUrl: '{{endpoint}}',
  secretToken: '{{apiKey}}',
});`,
    docsUrl: "https://www.elastic.co/docs/apm/agents/nodejs/current",
  },
  {
    languageId: "go",
    label: "Go",
    installCommand: "go get go.elastic.co/apm/v2",
    initSnippet: `import "go.elastic.co/apm/v2"

// Set environment variables before starting your app
// ELASTIC_APM_SERVICE_NAME=my-service
// ELASTIC_APM_SERVER_URL={{endpoint}}
// ELASTIC_APM_SECRET_TOKEN={{apiKey}}`,
    docsUrl: "https://www.elastic.co/docs/apm/agents/go/current",
  },
  {
    languageId: "dotnet",
    label: ".NET",
    installCommand: "dotnet add package Elastic.Apm.NetCoreAll",
    initSnippet: `// In appsettings.json
{
  "ElasticApm": {
    "ServiceName": "my-service",
    "ServerUrls": "{{endpoint}}",
    "SecretToken": "{{apiKey}}"
  }
}

// In Program.cs / Startup.cs
app.UseAllElasticApm(Configuration);`,
    docsUrl: "https://www.elastic.co/docs/apm/agents/dotnet/current",
  },
  {
    languageId: "ruby",
    label: "Ruby",
    installCommand: "gem install elastic-apm",
    initSnippet: `# config/elastic_apm.yml
service_name: my-service
server_url: '{{endpoint}}'
secret_token: '{{apiKey}}'`,
    docsUrl: "https://www.elastic.co/docs/apm/agents/ruby/current",
  },
  {
    languageId: "php",
    label: "PHP",
    installCommand: `# Install via package manager
apt-get install -y apm-agent-php
# or for Alpine: apk add --allow-untrusted apm-agent-php.apk`,
    initSnippet: `; Add to php.ini
elastic_apm.service_name = "my-service"
elastic_apm.server_url = "{{endpoint}}"
elastic_apm.secret_token = "{{apiKey}}"`,
    docsUrl: "https://www.elastic.co/docs/apm/agents/php/current",
  },
];

export const APM_LANGUAGE_BY_ID: ReadonlyMap<string, ApmLanguageDefinition> = new Map(
  APM_LANGUAGE_CATALOG.map((l) => [l.languageId, l]),
);
