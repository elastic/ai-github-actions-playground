# Console

Open Console from the sidebar to send raw HTTP requests to Elasticsearch without leaving Peek.

Each request card lets you choose method, path, and optional JSON body for `POST`, `PUT`, and `PATCH`.

Use Add Request to build multiple requests and Run All to execute a batch sequence quickly during debugging.

Responses include HTTP status, execution time, and a formatted JSON body you can copy to share in issues or investigations.

Use the **Copy as cURL** button (clipboard icon next to Send) to copy the current request as a runnable `curl` command. The command includes the full URL, `Content-Type` header, and any active auth credentials, making it ready to paste into a terminal, runbook, or support ticket.

If a request fails, check the path first, then payload JSON validity, then user permissions for the target API.
