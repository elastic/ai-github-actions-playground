# Data Streams

Open Data Streams from the sidebar to inspect stream metadata and field capabilities without writing API calls manually.

Search streams by name, optionally include hidden system streams, and select a stream to view status, generation, backing indices, and ILM policy.

Use the field search box to quickly locate dimensions and metrics before building queries in Query Lab or Metrics.

Click any field row to open the **Field Stats** panel for that field. The panel shows:

- **Confidence badge** — indicates how representative the stats are based on sample coverage:
  - **High confidence** (green) — the entire stream was analyzed; stats are exact.
  - **Medium confidence** (yellow) — the stream is approaching the sample limit; stats are nearly complete but may become approximate for very large streams.
  - **Low confidence** (red) — the sample limit was reached; stats reflect only a subset of documents. Treat values as approximate and use Query Lab for more precise analysis.
- **Total docs** — total document count in the stream.
- **Non-null** — number of documents where the field has a value.
- **Null %** — percentage of documents where the field is absent or null.
- **Cardinality** — approximate number of distinct values.
- **Top values** — the most frequent values and their counts (shown for keyword and other text-like field types).
- **Min / Max** — the smallest and largest observed values (shown for numeric and date field types).

Field Stats are computed from a sample of up to 50,000 documents. For large streams where the sample limit is reached, the confidence badge turns red and the stats should be interpreted as approximations rather than exact figures.

Click **Open stats query in Query Lab** inside the Field Stats panel to pivot directly to Query Lab with a pre-built query for that field. The query type depends on the field type:

- **Keyword-like fields** (keyword, constant_keyword, etc.) — generates a top-values aggregation query.
- **Numeric and date fields** — generates a min/max stats query.

Click **Open in Query Lab** at the stream level to seed a starter query for the selected stream and continue analysis with full ES|QL control.

Click **Inspect in Console** to open the API Console with a prefilled `GET /_data_stream/{name}` request for the selected stream. From there you can execute the request, edit it, or build further API calls.

If fields fail to load, refresh the page and verify that your role can access `_field_caps` and data stream metadata APIs.
