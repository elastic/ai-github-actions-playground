# Connecting to Elasticsearch

Click the connection chip or gear icon in the header to open connection settings.

Enter your Elasticsearch URL and choose API Key or Username/Password authentication.

Use `http://localhost:3000/_es` when running with the local proxy in development, or your direct cluster URL when CORS is configured for browser access.

Use API keys for least-privilege access in shared environments, and reserve username/password auth for development or dedicated operator workflows.

Your URL is saved in localStorage for convenience. Credentials are stored in sessionStorage and cleared when you close the tab.

If the connection test fails, verify the URL first, then authentication details, then whether your cluster can be reached from the browser network.
