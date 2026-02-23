/**
 * Comprehensive ES|QL syntax reference used as system prompt context for
 * LLM-powered inline completions. This gives the model deep knowledge of
 * ES|QL syntax, commands, functions, Elastic field conventions, and common
 * query patterns so it can produce accurate completions.
 */
export const ESQL_SYNTAX_GUIDE = `
# ES|QL Query Language Reference — Logs, Metrics & Traces

## 1. Syntax Fundamentals

ES|QL is a **piped query language** — NOT SQL. Every query starts with a **source command** followed by zero or more **processing commands** separated by \`|\`.

\`\`\`
source-command
| processing-command1
| processing-command2
\`\`\`

### Key Syntax Rules

- Keywords are case-insensitive: FROM, from, From are equivalent. Convention is UPPERCASE.
- String literals use double quotes: "value". Escape with \\". Triple-quotes """...""" are supported.
- Field names with special characters (dots, spaces, starts with number) must use backticks: \`my.field\`, \`1.field\`.
- Comments: Use // for single-line comments.
- Implicit LIMIT: Queries return max 1,000 rows by default. Maximum configurable is 10,000 rows.
- Timespan literals: 1 hour, 30 minutes, 7 days, 2 weeks, 1 year. Not whitespace-sensitive: 1hour = 1 hour.
- Type casting: Use ::type syntax, e.g., field::long, field::string, AVG(x)::LONG.
- NULL checks: Use IS NULL and IS NOT NULL (not = NULL).
- Kibana time parameters: Use ?_tstart and ?_tend for Kibana time picker integration.

---

## 2. Source Commands

### FROM
Retrieves data from indices, data streams, or aliases. Supports wildcards and comma-separated patterns.

FROM logs-*
FROM logs-*, metrics-*
FROM logs-nginx.access-default
FROM .ds-traces-apm-default-*

METADATA: Access document metadata fields:
FROM logs-* METADATA _index, _id

### ROW
Creates a single row with literal values. Useful for testing expressions.
ROW x = 1, y = "hello", z = [1, 2, 3]

### SHOW
Returns system information.
SHOW INFO

---

## 3. Processing Commands

### WHERE — Filter rows

FROM logs-*
| WHERE @timestamp > NOW() - 1 hour
| WHERE log.level == "error"
| WHERE message LIKE "*timeout*"
| WHERE host.name RLIKE "web-server-[0-9]+"
| WHERE service.name IN ("frontend", "backend", "gateway")
| WHERE http.response.status_code >= 400 AND http.response.status_code < 500
| WHERE error.message IS NOT NULL

Full-text search functions (GA in 9.1+):
| WHERE MATCH(message, "connection refused")
| WHERE QSTR("message:error AND host.name:web*")
| WHERE KQL("log.level: error and service.name: payments")
| WHERE MATCH_PHRASE(message, "connection reset by peer")

### EVAL — Add computed columns

FROM logs-*
| EVAL duration_ms = event.duration / 1000000
| EVAL is_error = CASE(http.response.status_code >= 500, true, false)
| EVAL request_path = CONCAT(url.scheme, "://", url.domain, url.path)
| EVAL timestamp_hour = DATE_TRUNC(1 hour, @timestamp)

If a column name already exists, EVAL overwrites it.

### STATS ... BY — Aggregation

FROM logs-*
| STATS
    total_requests = COUNT(*),
    error_count = COUNT(*) WHERE http.response.status_code >= 500,
    avg_duration = AVG(event.duration),
    p99_duration = PERCENTILE(event.duration, 99)
  BY service.name

Conditional aggregation (inline WHERE on each expression):
| STATS
    ok = COUNT(*) WHERE http.response.status_code < 400,
    client_err = COUNT(*) WHERE http.response.status_code >= 400 AND http.response.status_code < 500,
    server_err = COUNT(*) WHERE http.response.status_code >= 500
  BY service.name

Time bucketing:
| STATS request_count = COUNT(*) BY BUCKET(@timestamp, 5 minutes)
| STATS avg_bytes = AVG(http.response.body.bytes) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)

Performance note: STATS without BY is much faster. Grouping on a single field is ~5x faster than multiple fields.

### KEEP — Select columns (whitelist)
| KEEP @timestamp, message, log.level, service.name
| KEEP host.*, service.*    // wildcards supported

### DROP — Remove columns (blacklist)
| DROP agent.*, ecs.version, event.original

### RENAME — Rename columns
| RENAME service.name AS svc, host.name AS hostname

### SORT — Order results
| SORT @timestamp DESC
| SORT service.name ASC, event.duration DESC NULLS LAST

### LIMIT — Cap row count
| LIMIT 100
Max: 10,000 rows per query.

### DISSECT — Extract structured fields with delimiter patterns
| DISSECT message "%{clientip} - - [%{timestamp}] \\"%{method} %{path} HTTP/%{version}\\" %{status} %{bytes}"
Use DISSECT when the format is fixed/predictable. Faster than GROK.

### GROK — Extract structured fields with regex patterns
| GROK message "%{COMMONAPACHELOG}"
| GROK message "%{IP:client_ip} .* %{NUMBER:response_code:int}"
Use GROK when format varies or needs regex flexibility. Slower than DISSECT.

### ENRICH — Join with an enrich policy
| ENRICH geo-policy ON source.ip WITH country, city, location

### LOOKUP JOIN — SQL-style left join with a lookup index (8.18+, GA 9.1+)
| LOOKUP JOIN service_owners ON service.name
| KEEP @timestamp, message, service.name, owner, team

LOOKUP JOIN gotchas:
- Output row order is not preserved — always add SORT after a LOOKUP JOIN.
- On field name collisions, lookup fields override existing columns. Use RENAME before the join to preserve originals.

### FORK — Branch and merge queries (tech preview, 9.1+)
FROM logs-*
| FORK
    (WHERE log.level == "error" | STATS error_count = COUNT(*) BY service.name)
    (WHERE log.level == "warning" | STATS warn_count = COUNT(*) BY service.name)

### INLINE STATS — Add aggregation without collapsing rows (9.2+)
| INLINE STATS avg_dur = AVG(event.duration) BY service.name
| EVAL relative_duration = event.duration / avg_dur

Unlike STATS, INLINE STATS preserves original rows and appends the aggregated columns.

### SAMPLE — Random sampling (9.1+)
| SAMPLE 0.01

---

## 4. Aggregation Functions

### Standard Aggregations
COUNT(*) — Count all rows
COUNT(field) — Count non-null values
COUNT_DISTINCT(field) — Approximate distinct count
AVG(field) — Average
SUM(field) — Sum
MIN(field) — Minimum
MAX(field) — Maximum
MEDIAN(field) — 50th percentile (approximate)
PERCENTILE(field, pct) — Percentile (approximate)
STD_DEV(field) — Standard deviation
VARIANCE(field) — Variance
MEDIAN_ABSOLUTE_DEVIATION(field) — Robust variability measure
TOP(field, n, order) — Top N values
VALUES(field) — All unique values (multi-value)
SAMPLE(field) — Random sample value
WEIGHTED_AVG(value, weight) — Weighted average

### Grouping Functions
BUCKET(@timestamp, interval) — Fixed time buckets, e.g. BY BUCKET(@timestamp, 5 minutes)
BUCKET(@timestamp, n, start, end) — Auto-sized buckets, e.g. BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)
BUCKET(numeric, interval) — Numeric range buckets
CATEGORIZE(field) — Auto-categorize text patterns

---

## 5. Scalar Functions

### String Functions
CONCAT(str1, str2, ...) — Concatenate strings
SUBSTRING(str, start, length) — Extract substring (1-indexed)
LEFT(str, n) / RIGHT(str, n) — Left/right N characters
LENGTH(str) — String length
TRIM(str) / LTRIM / RTRIM — Trim whitespace
TO_LOWER(str) / TO_UPPER(str) — Case conversion
REPLACE(str, old, new) — Replace first occurrence
SPLIT(str, delim) — Split into multi-value
STARTS_WITH(str, prefix) — Boolean prefix check
ENDS_WITH(str, suffix) — Boolean suffix check
LOCATE(str, substr) — Find position of substring
REVERSE(str) — Reverse string
REPEAT(str, n) — Repeat string N times

### Date/Time Functions
NOW() — Current timestamp
DATE_TRUNC(1 hour, @timestamp) — Truncate to interval
DATE_EXTRACT("year", @timestamp) — Extract component: year, month, day, hour, minute, second
DATE_FORMAT("yyyy-MM-dd", @timestamp) — Format as string
DATE_DIFF("seconds", start, end) — Difference between dates
DATE_PARSE("yyyy-MM-dd", date_string) — Parse string to date

### Math Functions
ABS(n) — Absolute value
ROUND(n, decimals) — Round to N decimals
CEIL(n) / FLOOR(n) — Ceiling / floor
POW(base, exp) — Power
SQRT(n) / CBRT(n) — Square / cube root
LOG(n) / LOG10(n) — Natural / base-10 log
PI() / E() / TAU() — Constants
GREATEST(a, b, ...) / LEAST(a, b, ...) — Max/min of arguments
CLAMP(value, min, max) — Clamp to range

### Type Conversion Functions
TO_STRING(x), TO_LONG(x), TO_INTEGER(x), TO_DOUBLE(x), TO_BOOLEAN(x), TO_DATETIME(x), TO_IP(x), TO_VERSION(x), TO_UNSIGNED_LONG(x), TO_DATE_NANOS(x)

### Conditional Functions
CASE(cond1, val1, cond2, val2, ..., default) — If/else chain
COALESCE(a, b, c) — First non-null
GREATEST(a, b) / LEAST(a, b) — Min/max of values

### Multi-Value (MV) Functions
MV_COUNT(field), MV_FIRST(field), MV_LAST(field), MV_MIN(field), MV_MAX(field), MV_AVG(field), MV_SUM(field), MV_MEDIAN(field), MV_CONTAINS(field, value), MV_CONCAT(field, delim), MV_DEDUPE(field), MV_SORT(field, "ASC"), MV_SLICE(field, start, end), MV_APPEND(field1, field2)

### IP Functions
CIDR_MATCH(ip, "10.0.0.0/8", "172.16.0.0/12") — Check IP in CIDR ranges
TO_IP(string) — Convert to IP type

---

## 6. Operators

Comparison: ==, !=, <, <=, >, >=
Logical: AND, OR, NOT
Pattern matching: LIKE "pattern*" (wildcards * and ?), RLIKE "regex", NOT LIKE, IN ("a", "b", "c")
Null: IS NULL, IS NOT NULL
Arithmetic: +, -, *, /, % (modulo)

---

## 7. Elastic Observability Field Reference

### Common Index Patterns
Logs: logs-*, logs-*.otel-*, filebeat-*
Metrics: metrics-*, metrics-*.otel-*, metricbeat-*
Traces/Spans: traces-apm*, traces-*.otel-*

### Common Fields Across All Signals
@timestamp — Event timestamp (datetime)
data_stream.type — logs, metrics, or traces (keyword)
data_stream.dataset — e.g., nginx.access, system.cpu (keyword)
data_stream.namespace — e.g., default, production (keyword)
service.name — Application/service name (keyword)
service.version — Service version (keyword)
service.environment — Deployment environment (keyword)
host.name — Hostname (keyword)
host.ip — Host IP address (ip)
agent.name — Collection agent (keyword)
cloud.provider — AWS, GCP, Azure (keyword)
cloud.region — Cloud region (keyword)
container.id — Container ID (keyword)
kubernetes.pod.name — K8s pod name (keyword)
kubernetes.namespace — K8s namespace (keyword)
kubernetes.node.name — K8s node name (keyword)

### Log-Specific Fields
message — Log message body (text)
log.level — Log level: debug, info, warn, error, fatal (keyword)
log.logger — Logger name (keyword)
log.file.path — Source file path (keyword)
error.message — Error message (text)
error.stack_trace — Stack trace (text)
error.type — Error/exception class (keyword)
trace.id — Trace ID for correlation (keyword)
span.id — Span ID for correlation (keyword)
event.dataset — Dataset identifier (keyword)

### Metric-Specific Fields
system.cpu.total.norm.pct — CPU usage 0-1 (scaled_float)
system.memory.used.pct — Memory usage 0-1 (scaled_float)
system.memory.used.bytes — Memory used in bytes (long)
system.filesystem.used.pct — Disk usage 0-1 (scaled_float)
system.network.in.bytes — Network bytes received (long)
system.network.out.bytes — Network bytes sent (long)
system.load.1 / system.load.5 / system.load.15 — Load averages (scaled_float)

### Trace/Span-Specific Fields
trace.id — Trace identifier (keyword)
span.id — Span identifier (keyword)
parent.id — Parent span ID (keyword)
transaction.id — Transaction ID (keyword)
transaction.name — e.g., GET /api/users (keyword)
transaction.type — request, messaging, etc. (keyword)
transaction.result — HTTP 2xx, success, etc. (keyword)
transaction.duration.us — Duration in microseconds (long)
span.name — Span operation name (keyword)
span.type — db, external, cache, etc. (keyword)
span.subtype — postgresql, redis, http (keyword)
span.duration.us — Span duration in microseconds (long)
span.destination.service.resource — Target resource (keyword)
http.request.method — HTTP method (keyword)
http.response.status_code — HTTP status (integer)
url.full — Full URL (keyword)
url.path — URL path (keyword)
db.statement — Database query (text)
db.system — postgresql, mysql, etc. (keyword)

---

## 8. Example Queries

### Logs

Recent errors for a service:
FROM logs-*
| WHERE @timestamp > NOW() - 1 hour AND log.level == "error" AND service.name == "payments"
| KEEP @timestamp, message, error.message, host.name
| SORT @timestamp DESC
| LIMIT 50

Error rate per service over time:
FROM logs-*
| WHERE @timestamp > NOW() - 24 hours
| STATS total = COUNT(*), errors = COUNT(*) WHERE log.level == "error" BY service.name, BUCKET(@timestamp, 1 hour)
| EVAL error_rate = ROUND(errors / total * 100, 2)

Top error messages:
FROM logs-*
| WHERE @timestamp > NOW() - 6 hours AND log.level == "error"
| STATS count = COUNT(*) BY error.message
| SORT count DESC
| LIMIT 20

Auto-categorize log patterns:
FROM logs-*
| WHERE @timestamp > NOW() - 1 hour AND log.level == "error"
| STATS count = COUNT(*) BY CATEGORIZE(message)
| SORT count DESC

### Metrics

CPU usage by host:
FROM metrics-system.cpu-*
| WHERE @timestamp > NOW() - 15 minutes
| STATS avg_cpu = AVG(system.cpu.total.norm.pct) BY host.name
| EVAL avg_cpu_pct = ROUND(avg_cpu * 100, 2)
| SORT avg_cpu_pct DESC

Memory usage over time:
FROM metrics-system.memory-*
| WHERE @timestamp > NOW() - 4 hours
| STATS avg_mem = AVG(system.memory.used.pct) BY host.name, BUCKET(@timestamp, 5 minutes)
| EVAL avg_mem_pct = ROUND(avg_mem * 100, 2)

Network throughput:
FROM metrics-system.network-*
| WHERE @timestamp > NOW() - 1 hour
| STATS in_bytes = SUM(system.network.in.bytes), out_bytes = SUM(system.network.out.bytes) BY host.name, BUCKET(@timestamp, 5 minutes)
| EVAL in_mbps = ROUND(in_bytes / 1024 / 1024, 2), out_mbps = ROUND(out_bytes / 1024 / 1024, 2)

### Traces

Slowest transactions:
FROM traces-apm*
| WHERE @timestamp > NOW() - 1 hour AND transaction.type == "request"
| EVAL duration_ms = transaction.duration.us / 1000
| SORT duration_ms DESC
| KEEP @timestamp, service.name, transaction.name, duration_ms, http.response.status_code
| LIMIT 25

Service latency percentiles:
FROM traces-apm*
| WHERE @timestamp > NOW() - 4 hours AND transaction.type == "request"
| STATS p50 = PERCENTILE(transaction.duration.us, 50), p95 = PERCENTILE(transaction.duration.us, 95), p99 = PERCENTILE(transaction.duration.us, 99), throughput = COUNT(*) BY service.name
| EVAL p50_ms = ROUND(p50 / 1000, 2), p95_ms = ROUND(p95 / 1000, 2), p99_ms = ROUND(p99 / 1000, 2)
| SORT p99_ms DESC

Error rate by endpoint:
FROM traces-apm*
| WHERE @timestamp > NOW() - 1 hour AND transaction.type == "request"
| STATS total = COUNT(*), errors = COUNT(*) WHERE http.response.status_code >= 500 BY transaction.name
| EVAL error_rate_pct = ROUND(errors * 100.0 / total, 2)
| WHERE total > 10
| SORT error_rate_pct DESC

Database spans analysis:
FROM traces-apm*
| WHERE @timestamp > NOW() - 1 hour AND span.type == "db"
| STATS avg_duration_ms = AVG(span.duration.us) / 1000, count = COUNT(*) BY span.subtype, span.name
| SORT avg_duration_ms DESC
| LIMIT 20

Trace-to-log correlation:
FROM logs-*
| WHERE trace.id == "<trace_id>"
| SORT @timestamp ASC
| KEEP @timestamp, message, log.level, service.name, span.id

---

## 9. Gotchas & Best Practices

### Critical Gotchas
1. ES|QL is NOT SQL — No SELECT, no GROUP BY, no HAVING, no subqueries, no UNION.
2. Implicit 1000-row limit — Always use LIMIT explicitly or understand that results are capped.
3. LOOKUP JOIN does not preserve order — Always SORT after a LOOKUP JOIN.
4. LOOKUP JOIN overrides columns — If the lookup index has a field with the same name, it replaces the original.
5. STATS collapses rows — Unlike INLINE STATS, STATS reduces your table to one row per group.
6. Backtick computed column names — If you write STATS AVG(salary), the output column is named AVG(salary) and must be referenced as \`AVG(salary)\` in subsequent commands.
7. Multi-valued fields — Many Elasticsearch fields are multi-valued. Use MV_* functions to handle them.
8. PERCENTILE and MEDIAN are approximate (T-digest).
9. No HAVING — Filter aggregation results using WHERE after STATS, or use inline WHERE within the STATS expression.
10. Type strictness — Use explicit casting: TO_LONG(), TO_STRING(), TO_DATETIME().
11. Timespan arithmetic — Use NOW() - 1 hour, not NOW() - INTERVAL '1' HOUR.

### Performance Tips
- Filter early: Put WHERE clauses (especially on @timestamp) as early as possible.
- Use KEEP/DROP: Reduce columns to minimize data transfer.
- Single group keys: Grouping on one field is ~5x faster than multiple fields.
- Prefer DISSECT over GROK: DISSECT is faster for fixed-format strings.
- Leverage STATS ... WHERE: Inline conditional aggregation avoids extra passes.
- Time-bound everything: Always include @timestamp filters to limit scan range.

---

## 10. Command Pipeline Pattern

FROM <index-pattern>                          -- Source: what data to read
| WHERE <time_filter> AND <conditions>        -- Filter: narrow early
| EVAL <new_col> = <expression>               -- Transform: compute new fields
| GROK/DISSECT <field> "<pattern>"            -- Parse: extract from strings
| LOOKUP JOIN <lookup_index> ON <field>       -- Enrich: add reference data
| STATS <agg> = <func>(<field>) BY <groups>   -- Aggregate: summarize
| EVAL <derived> = <expression>               -- Post-process aggregates
| WHERE <filter_on_aggregates>                -- Filter aggregated results
| SORT <field> DESC                           -- Order results
| KEEP <fields>                               -- Select output columns
| LIMIT <n>                                   -- Cap output

---

## 11. Kibana / Peek Integration

- Time picker binding: Use ?_tstart and ?_tend to sync with the time range.
- Auto-sized time buckets: BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)
- Dashboard variables: Use ?variable_name for single-value controls and ??variable_name for field/function controls.
`.trim();
