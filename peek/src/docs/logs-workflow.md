# Logs

Open Logs from the sidebar to explore log data with a query-visible workflow: every filter and search action updates the ES|QL editor.

Use the **Search logs** input for free text. Enter plain text to generate `message : "..."`, or wrap the text in quotes to generate `MATCH_PHRASE(message, "...")`.

Use filter chips to review and remove active clauses. Chips, search text, and query editor all contribute to the same ES|QL query.

Use the **Field Filters** sidebar to quickly include (`+`) or exclude (`-`) common dimensions such as `service.name` and `log.level`.

Click any table cell to add an inclusion filter for that field/value pair. Clicking a `trace.id` cell pivots to Query Lab with a trace-scoped query draft.

Edit the ES|QL directly in the editor when you need full control. Press **Search Logs** (or Ctrl/Cmd+Enter) to run the current query.
