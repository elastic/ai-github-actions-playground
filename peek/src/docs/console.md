# Console

Open Console from the sidebar to send raw HTTP requests to Elasticsearch without leaving Peek. Console is useful for debugging, exploring APIs, and running one-off operations that are not covered by other pages.

## Building requests

Each request card lets you choose a method (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`), set the path, and provide an optional JSON body for methods that accept one.

- Type an Elasticsearch API path in the **Path** field (e.g., `/_cluster/health`, `/_cat/indices?v`).
- Add a JSON body for `POST`, `PUT`, and `PATCH` requests.
- Click **Send** to execute the request.

## Batch requests

Click **Add Request** to build multiple request cards. Use **Run All** to execute the entire batch in sequence — useful for scripted debugging sessions where you need to run several API calls in order.

## Response handling

Responses include:

- **HTTP status code** — color-coded (green for 2xx, yellow for 4xx, red for 5xx).
- **Execution time** — how long the request took.
- **Formatted JSON body** — syntax-highlighted response you can copy.

## Copy as cURL

Click the **clipboard icon** next to Send to copy the current request as a runnable `curl` command. The command includes the full URL, `Content-Type` header, and any active auth credentials, ready to paste into a terminal, runbook, or support ticket.

## Tips

- Use `?pretty` or `?format=json` query parameters to control response formatting for APIs that support them.
- Use `_cat` APIs with `?v` for human-readable column headers.
- Combine Console with the Docs page to look up API endpoints while building requests.

## Troubleshooting

If a request fails, check in this order:

1. **Path** — verify the API path is correct and complete.
2. **Body** — confirm the JSON body is valid (no trailing commas, proper quoting).
3. **Permissions** — ensure your credentials have the required cluster or index privileges for the target API.
