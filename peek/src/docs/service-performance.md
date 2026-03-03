# Service Performance

Open Service Performance from the sidebar to view an APM dashboard showing key performance metrics across your services from OpenTelemetry trace data.

Use the date range picker to select the time window for your analysis, then click Search to discover services. Click Reset to clear results and return to the default state.

After searching, four overview cards appear at the top: Total Services, Total Requests, Avg Latency, and Error Rate. The error rate card turns red when it exceeds 5%.

Below the overview cards, four charts show ranked breakdowns: Slowest Services and Highest Error Rate display the top five services by latency and error rate respectively, while Services by Language and Services by Environment show distribution breakdowns across your fleet.

The Busiest Services panel ranks the top five services by request count, showing each service's language, environment, latency, error rate, and top error message. Click View Traces on any row to pivot directly to the Traces page filtered to that service and time range.

The All Services table lists every discovered service with sortable columns for Service Name, Requests, Avg Latency, Error Rate, Language, Environment, Unique Routes, Unique Span Names, Top Route, Top Span Name, and Top Error. Click any column header to sort. Each row includes a View Traces button to jump to the Traces page for that service.

If no services are found, verify that your Elasticsearch index contains OpenTelemetry-compatible trace data and that the selected time range covers periods with active traffic.
