/**
 * Converts the app's Span[] to OTLP TracesData format for the Perses TracingGanttChart.
 */

import type { otlpcommonv1, otlptracev1 } from "@perses-dev/core";

import type { Span, SpanEvent, SpanLink } from "./traceUtils";

/** Convert a primitive value to an OTLP AnyValue. */
function toAnyValue(value: unknown): otlpcommonv1.AnyValue {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toAnyValue) } };
  }
  return { stringValue: String(value ?? "") };
}

/** Convert a flat attribute record to OTLP KeyValue[]. */
function toKeyValues(attrs: Record<string, unknown>): otlpcommonv1.KeyValue[] {
  return Object.entries(attrs).map(([key, value]) => ({ key, value: toAnyValue(value) }));
}

/** Map an app status string to an OTLP Status object. */
function toOtlpStatus(status: string): otlptracev1.Status {
  if (status === "Error" || status === "STATUS_CODE_ERROR") {
    return { code: "STATUS_CODE_ERROR" };
  }
  if (status === "OK" || status === "STATUS_CODE_OK") {
    return { code: "STATUS_CODE_OK" };
  }
  return { code: "STATUS_CODE_UNSET" };
}

function microsToNanosString(micros: number): string {
  return Number.isFinite(micros) ? (BigInt(Math.trunc(micros)) * 1_000n).toString() : "0";
}

function isoToNanosString(timestamp: string): string {
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) ? (BigInt(ms) * 1_000_000n).toString() : "0";
}

/** Convert app SpanEvents to OTLP Events. */
function convertEvents(events: SpanEvent[]): otlptracev1.Event[] {
  return events.map((e) => ({
    timeUnixNano: isoToNanosString(e.timestamp),
    name: e.name,
    attributes: toKeyValues(e.attributes),
  }));
}

/** Convert app SpanLinks to OTLP Links. */
function convertLinks(links: SpanLink[]): otlptracev1.Link[] {
  return links.map((l) => ({
    traceId: l.traceId,
    spanId: l.spanId,
    attributes: toKeyValues(l.attributes),
  }));
}

/** Convert a single app Span to an OTLP Span. */
function convertSpan(span: Span): otlptracev1.Span {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId ?? undefined,
    name: span.name,
    kind: span.kind || undefined,
    startTimeUnixNano: microsToNanosString(span.startTimeUs),
    endTimeUnixNano: microsToNanosString(span.startTimeUs + span.durationUs),
    attributes: toKeyValues(span.attributes),
    events: span.events ? convertEvents(span.events) : undefined,
    links: span.links ? convertLinks(span.links) : undefined,
    status: toOtlpStatus(span.status),
  };
}

/**
 * Convert the app's Span[] to OTLP TracesData for the Perses TracingGanttChart.
 *
 * Groups spans by serviceName into separate ResourceSpan entries so that the
 * gantt chart can colour-code by service.
 */
export function spansToOtlpTracesData(spans: Span[]): otlptracev1.TracesData {
  const byService = new Map<string, Span[]>();
  for (const span of spans) {
    const list = byService.get(span.serviceName);
    if (list) {
      list.push(span);
    } else {
      byService.set(span.serviceName, [span]);
    }
  }

  const resourceSpans: otlptracev1.ResourceSpan[] = [];
  for (const [serviceName, serviceSpans] of byService) {
    resourceSpans.push({
      resource: {
        attributes: [{ key: "service.name", value: { stringValue: serviceName } }],
      },
      scopeSpans: [{ spans: serviceSpans.map(convertSpan) }],
    });
  }

  return { resourceSpans };
}
