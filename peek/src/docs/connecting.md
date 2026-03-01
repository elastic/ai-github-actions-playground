# Connecting to Elasticsearch

Click the connection chip or gear icon in the header to open connection settings.

Enter your Elasticsearch URL and choose API Key or Username/Password authentication.

Use `http://localhost:3000/_es` when running with the local proxy in development, or your direct cluster URL when CORS is configured for browser access.
Expand **Proxy Settings** in the connection dialog to route requests through a proxy; Peek will
automatically forward your Elasticsearch URL as a routing header.

Use API keys for least-privilege access in shared environments, and reserve username/password auth for development or dedicated operator workflows.

Your URL is saved in localStorage for convenience. By default, credentials are stored in sessionStorage and cleared when you close the tab. If you lock a profile with a PIN, credentials are encrypted and stored in localStorage so they persist across sessions. Unlocking a PIN-locked profile requires re-entering the PIN to decrypt the credentials.

If the connection test fails, verify the URL first, then authentication details, then whether your cluster can be reached from the browser network.

## Connection Profiles

You can save multiple named connection profiles so you don't have to re-enter URLs and credentials when switching between clusters (e.g. dev, staging, production).

- **Save a profile**: Enter connection details in the dialog, then type a profile name and click "Save Profile".
- **Switch profiles**: Click the profile chip in the header to open the quick switcher menu. Selecting a profile will attempt to connect automatically.
- **Load a profile in the dialog**: Click a saved profile in the "Saved Profiles" list to populate the form fields, then click "Connect".
- **Rename a profile**: Double-click a profile name in the dialog to edit it, or click the edit icon.
- **Delete a profile**: Click the delete icon next to a profile in the dialog, then confirm.
- **Re-test a saved profile**: In the quick switcher menu, click the refresh icon next to any profile to test its connection without switching to it. A brief spinning animation plays while the test runs. A toast notification confirms the result: a success message if the profile is reachable, or an error message with details if it is not. The health badge next to the profile name updates immediately to reflect the new status.

Profile URLs are persisted in localStorage. By default, profile credentials are stored in sessionStorage and cleared when you close the tab, just like the active connection. If you lock a profile with a PIN, its credentials are encrypted and persisted in localStorage instead, so they survive tab and browser restarts. You must enter the PIN to unlock and use the profile.

### Profile health badges

Each profile in the quick switcher menu displays a health badge that reflects the last known connection status:

- **Green check (✓)**: The profile was last tested successfully and is healthy. Hovering over the badge shows the "Healthy" tooltip.
- **Amber warning (⚠)**: The profile failed its last connection test. Hovering over the badge shows a short error summary describing what went wrong.
- **No badge**: The profile has not been tested yet in this session (status is unknown).

Badges are updated automatically whenever you switch to a profile or use the Re-test action. They are stored in memory and reset when you close or reload the tab.
