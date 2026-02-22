# Connecting to Elasticsearch

Click the connection chip or gear icon in the header to open connection settings.

Enter your Elasticsearch URL and choose API Key or Username/Password authentication.

Use `http://localhost:3000/_es` when running with the local proxy in development, or your direct cluster URL when CORS is configured for browser access.

Use API keys for least-privilege access in shared environments, and reserve username/password auth for development or dedicated operator workflows.

Your URL is saved in localStorage for convenience. Credentials are stored in sessionStorage and cleared when you close the tab.

If the connection test fails, verify the URL first, then authentication details, then whether your cluster can be reached from the browser network.

## Connection Profiles

You can save multiple named connection profiles so you don't have to re-enter URLs and credentials when switching between clusters (e.g. dev, staging, production).

- **Save a profile**: Enter connection details in the dialog, then type a profile name and click "Save Profile".
- **Switch profiles**: Click the profile chip in the header to open the quick switcher menu. Selecting a profile will attempt to connect automatically.
- **Load a profile in the dialog**: Click a saved profile in the "Saved Profiles" list to populate the form fields, then click "Connect".
- **Rename a profile**: Double-click a profile name in the dialog to edit it, or click the edit icon.
- **Delete a profile**: Click the delete icon next to a profile in the dialog, then confirm.

Profile URLs are persisted in localStorage. Profile credentials are stored in sessionStorage and cleared when you close the tab, just like the active connection.
