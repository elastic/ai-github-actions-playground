export const APACHE_MANIFEST = `format_version: 3.5.0
name: apache_input_otel
title: "Apache HTTP Server OpenTelemetry Input Package"
version: 0.1.0
source:
  license: "Elastic-2.0"
description: "Collect Apache HTTP Server status metrics using OpenTelemetry Collector"
type: input
categories:
  - web
  - observability
  - opentelemetry
conditions:
  kibana:
    version: "^9.2.0"
  elastic:
    subscription: "basic"
icons:
  - src: /img/logo_apache_otel.svg
    title: Apache OpenTelemetry logo
    size: 32x32
    type: image/svg+xml
policy_templates:
  - name: apachereceiver
    type: metrics
    title: Apache HTTP Server Metrics (OpenTelemetry)
    description: Collect Apache HTTP Server status metrics using OpenTelemetry Collector
    input: otelcol
    template_path: input.yml.hbs
    vars:
      - name: endpoint
        type: text
        required: true
        title: Endpoint
        description: The URL of the Apache server-status endpoint.
        default: http://localhost:8080/server-status?auto
        show_user: true
      - name: collection_interval
        type: duration
        required: false
        title: Collection Interval
        description: Time between each collection (e.g., 10s, 1m).
        default: 10s
        show_user: false
      - name: initial_delay
        type: duration
        required: false
        title: Initial Delay
        description: Defines how long this receiver waits before starting.
        default: 1s
        show_user: false
      - name: timeout
        type: duration
        required: false
        title: HTTP Timeout
        description: HTTP request timeout (e.g., 10s, 30s).
        default: 10s
        show_user: false
      - name: tls_enabled
        type: bool
        title: Enable TLS Configuration
        required: false
        description: Enable TLS configuration for HTTPS endpoints
        default: false
        show_user: true
      - name: tls_insecure
        type: bool
        required: false
        title: Disable TLS
        description: Whether to disable client transport security for the connection. Set to true to disable TLS.
        default: false
        show_user: false
      - name: tls_insecure_skip_verify
        type: bool
        required: false
        title: Skip TLS Verification
        description: Set to true to skip TLS certificate verification.
        default: false
        show_user: false
      - name: tls_ca_file
        type: text
        required: false
        title: TLS CA File
        description: Path to the CA certificate file for TLS verification.
        show_user: false
      - name: tls_cert_file
        type: text
        required: false
        title: TLS Certificate File
        description: Path to the client TLS certificate file.
        show_user: false
      - name: tls_key_file
        type: text
        required: false
        title: TLS Key File
        description: Path to the client TLS key file.
        show_user: false
      - name: tls_server_name_override
        type: text
        required: false
        title: TLS Server Name Override
        description: Override the server name used for TLS verification.
        show_user: false
owner:
  github: elastic/ecosystem
  type: elastic
`;

export const APACHE_TEMPLATE = `receivers:
  apache:
    endpoint: {{endpoint}}
    collection_interval: {{collection_interval}}
    initial_delay: {{initial_delay}}
    timeout: {{timeout}}
{{#if tls_enabled}}
    tls:
      insecure: {{tls_insecure}}
      insecure_skip_verify: {{tls_insecure_skip_verify}}
{{#if tls_ca_file}}
      ca_file: {{tls_ca_file}}
{{/if}}
{{#if tls_cert_file}}
      cert_file: {{tls_cert_file}}
{{/if}}
{{#if tls_key_file}}
      key_file: {{tls_key_file}}
{{/if}}
{{#if tls_server_name_override}}
      server_name_override: {{tls_server_name_override}}
{{/if}}
{{/if}}
processors:
  resourcedetection/system:
    detectors: ["system"]
service:
  pipelines:
    metrics:
      receivers: [apache]
      processors: [resourcedetection/system]
`;

export const APACHE_README = `# Apache HTTP Server OpenTelemetry Input Package

## Overview
The Apache HTTP Server OpenTelemetry Input Package for Elastic enables collection of telemetry data from Apache web servers.

## Requirements
- Apache HTTP Server 2.4.13+
- The mod_status module must be enabled and accessible

## Configuration
For the full list of settings, refer to the upstream documentation.
`;
