export const REDIS_MANIFEST = `format_version: 3.5.0
name: redis_input_otel
title: "Redis OpenTelemetry Input Package"
version: 0.1.0
source:
  license: "Elastic-2.0"
description: "Redis OpenTelemetry Input Package"
type: input
categories:
  - datastore
  - observability
  - opentelemetry
conditions:
  kibana:
    version: "^9.2.0"
  elastic:
    subscription: "basic"
icons:
  - src: /img/logo_redis_otel.svg
    title: Redis logo
    size: 32x32
    type: image/svg+xml
policy_templates:
  - name: redisreceiver
    type: metrics
    title: Redis OpenTelemetry Input
    description: Collect Redis metrics using OpenTelemetry Collector
    input: otelcol
    template_path: input.yml.hbs
    vars:
      - name: endpoint
        type: text
        required: true
        title: Endpoint
        description: The hostname and port of the Redis instance (e.g., localhost:6379).
        default: localhost:6379
        show_user: true
      - name: username
        type: text
        required: false
        title: Username
        description: Client username used to connect to a Redis 6.0+ instance.
        show_user: true
      - name: password
        type: password
        required: false
        title: Password
        description: The password used to access the Redis instance.
        secret: false
        show_user: true
      - name: transport
        type: select
        required: false
        title: Transport
        description: Defines the network to use for connecting to the server.
        multi: false
        default: tcp
        options:
          - text: TCP
            value: tcp
          - text: Unix Socket
            value: unix
        show_user: false
      - name: dialer_timeout
        type: duration
        required: false
        title: Dialer Timeout
        description: Maximum amount of time a dial will wait for a connect to complete.
        show_user: false
      - name: tls_insecure
        type: bool
        required: false
        title: Disable TLS
        description: Whether to disable client transport security for the connection.
        default: true
        show_user: false
      - name: tls_insecure_skip_verify
        type: bool
        required: false
        title: Skip TLS Verification
        description: Whether to skip verifying the server certificate when TLS is enabled.
        default: false
        show_user: false
      - name: tls_ca_file
        type: text
        required: false
        title: TLS CA File
        description: Path to the CA certificate file for server certificate verification.
        show_user: false
      - name: tls_cert_file
        type: text
        required: false
        title: TLS Certificate File
        description: Path to the TLS certificate file for client authentication.
        show_user: false
      - name: tls_key_file
        type: text
        required: false
        title: TLS Key File
        description: Path to the TLS key file for client authentication.
        show_user: false
      - name: tls_server_name_override
        type: text
        required: false
        title: TLS Server Name Override
        description: Override the virtual host name of authority in TLS requests.
        show_user: false
      - name: tls_min_version
        type: select
        required: false
        title: TLS Min Version
        description: Minimum acceptable TLS version.
        show_user: false
        options:
          - text: "1.0"
            value: "1.0"
          - text: "1.1"
            value: "1.1"
          - text: "1.2"
            value: "1.2"
          - text: "1.3"
            value: "1.3"
      - name: tls_max_version
        type: select
        required: false
        title: TLS Max Version
        description: Maximum acceptable TLS version.
        show_user: false
        options:
          - text: "1.0"
            value: "1.0"
          - text: "1.1"
            value: "1.1"
          - text: "1.2"
            value: "1.2"
          - text: "1.3"
            value: "1.3"
      - name: tls_include_system_ca_certs_pool
        type: bool
        required: false
        title: Include System CA Certs Pool
        description: Whether to load the system certificate authorities pool.
        default: false
        show_user: false
      - name: collection_interval
        type: duration
        required: false
        title: Collection Interval
        description: Time between each metric collection (e.g., 10s, 1m).
        default: 10s
        show_user: false
      - name: initial_delay
        type: duration
        required: false
        title: Initial Delay
        description: Defines how long this receiver waits before starting.
        default: 1s
        show_user: false
owner:
  github: elastic/ecosystem
  type: elastic
`;

export const REDIS_TEMPLATE = `receivers:
  redis:
    endpoint: {{endpoint}}
    collection_interval: {{collection_interval}}
    initial_delay: {{initial_delay}}
{{#if username}}
    username: {{username}}
{{/if}}
{{#if password}}
    password: {{password}}
{{/if}}
    transport: {{transport}}
{{#if dialer_timeout}}
    dialer:
      timeout: {{dialer_timeout}}
{{/if}}
    tls:
      insecure: {{tls_insecure}}
{{#if tls_insecure_skip_verify}}
      insecure_skip_verify: {{tls_insecure_skip_verify}}
{{/if}}
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
{{#if tls_min_version}}
      min_version: "{{tls_min_version}}"
{{/if}}
{{#if tls_max_version}}
      max_version: "{{tls_max_version}}"
{{/if}}
{{#if tls_include_system_ca_certs_pool}}
      include_system_ca_certs_pool: {{tls_include_system_ca_certs_pool}}
{{/if}}
processors:
  resourcedetection/system:
    detectors: ["system"]
service:
  pipelines:
    metrics:
      receivers: [redis]
      processors: [resourcedetection/system]
`;
