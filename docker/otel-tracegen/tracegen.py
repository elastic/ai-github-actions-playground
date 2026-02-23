"""
Synthetic trace generator — web app + API gateway + microservices + DB.

Produces realistic hierarchical traces with:
- Varied latencies per service tier
- Occasional errors (5xx, timeouts, N+1 queries)
- Multiple service names and operation types
- HTTP and DB span attributes
"""

import random
import time
import logging

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.trace import StatusCode
from opentelemetry.semconv.trace import SpanAttributes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tracegen")

ENDPOINT = "otel-collector:4317"

# Service definitions with their own TracerProviders so each gets a distinct service.name
SERVICES = {
    "frontend-web": {"tier": "frontend"},
    "api-gateway": {"tier": "gateway"},
    "auth-service": {"tier": "backend"},
    "catalog-service": {"tier": "backend"},
    "order-service": {"tier": "backend"},
    "payment-service": {"tier": "backend"},
    "notification-service": {"tier": "backend"},
    "postgres": {"tier": "database"},
    "redis": {"tier": "cache"},
}

tracers = {}

def setup_tracers():
    for name in SERVICES:
        resource = Resource.create({"service.name": name})
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=ENDPOINT, insecure=True))
        )
        tracers[name] = provider.get_tracer("tracegen")


def random_latency(base_ms, jitter_ms):
    return (base_ms + random.uniform(-jitter_ms, jitter_ms)) / 1000.0


def maybe_error(rate=0.05):
    return random.random() < rate


def db_query(service, operation, table, base_ms=5, jitter_ms=3):
    tracer = tracers[service]
    with tracer.start_as_current_span(f"SELECT {table}") as span:
        span.set_attribute(SpanAttributes.DB_SYSTEM, "postgresql" if service == "postgres" else "redis")
        span.set_attribute(SpanAttributes.DB_OPERATION, operation)
        span.set_attribute(SpanAttributes.DB_NAME, "appdb")
        span.set_attribute("db.sql.table", table)
        time.sleep(random_latency(base_ms, jitter_ms))
        if maybe_error(0.02):
            span.set_status(StatusCode.ERROR, "connection timeout")
            span.set_attribute("error.type", "TimeoutError")


def cache_lookup(key_pattern, hit_rate=0.8):
    tracer = tracers["redis"]
    with tracer.start_as_current_span(f"GET {key_pattern}") as span:
        span.set_attribute(SpanAttributes.DB_SYSTEM, "redis")
        span.set_attribute(SpanAttributes.DB_OPERATION, "GET")
        hit = random.random() < hit_rate
        span.set_attribute("cache.hit", hit)
        time.sleep(random_latency(1, 0.5))
        return hit


def auth_check():
    tracer = tracers["auth-service"]
    with tracer.start_as_current_span("POST /auth/verify") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/auth/verify")
        cache_lookup("session:*")
        if not cache_lookup("token:*", hit_rate=0.9):
            db_query("postgres", "SELECT", "users")
        time.sleep(random_latency(8, 4))
        if maybe_error(0.03):
            span.set_status(StatusCode.ERROR, "invalid token")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 401)
        else:
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def catalog_list():
    tracer = tracers["catalog-service"]
    with tracer.start_as_current_span("GET /catalog/products") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/catalog/products")
        if not cache_lookup("catalog:products", hit_rate=0.7):
            db_query("postgres", "SELECT", "products", base_ms=12, jitter_ms=5)
            # Simulate N+1 query pattern occasionally
            if maybe_error(0.15):
                for _ in range(random.randint(3, 8)):
                    db_query("postgres", "SELECT", "product_images", base_ms=4, jitter_ms=2)
        time.sleep(random_latency(15, 8))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def catalog_detail():
    tracer = tracers["catalog-service"]
    product_id = random.randint(1, 500)
    with tracer.start_as_current_span(f"GET /catalog/products/{product_id}") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/catalog/products/:id")
        span.set_attribute("product.id", product_id)
        if not cache_lookup(f"product:{product_id}", hit_rate=0.6):
            db_query("postgres", "SELECT", "products")
            db_query("postgres", "SELECT", "product_reviews", base_ms=8, jitter_ms=4)
        time.sleep(random_latency(10, 5))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def create_order():
    tracer = tracers["order-service"]
    order_id = random.randint(10000, 99999)
    with tracer.start_as_current_span("POST /orders") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/orders")
        span.set_attribute("order.id", order_id)

        db_query("postgres", "INSERT", "orders", base_ms=10, jitter_ms=5)
        db_query("postgres", "SELECT", "inventory", base_ms=6, jitter_ms=3)

        # Payment
        payment_tracer = tracers["payment-service"]
        with payment_tracer.start_as_current_span("POST /payments/charge") as pay_span:
            pay_span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
            pay_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/payments/charge")
            pay_span.set_attribute("payment.method", random.choice(["card", "paypal", "apple_pay"]))
            time.sleep(random_latency(80, 40))
            if maybe_error(0.08):
                pay_span.set_status(StatusCode.ERROR, "payment declined")
                pay_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 402)
                span.set_status(StatusCode.ERROR, "payment failed")
                span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 422)
                return
            pay_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)

        db_query("postgres", "UPDATE", "orders", base_ms=8, jitter_ms=4)

        # Notification (fire-and-forget style, sometimes slow)
        notif_tracer = tracers["notification-service"]
        with notif_tracer.start_as_current_span("POST /notify/order-confirmation") as notif_span:
            notif_span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
            notif_span.set_attribute("notification.channel", random.choice(["email", "sms", "push"]))
            time.sleep(random_latency(20, 15))
            if maybe_error(0.05):
                notif_span.set_status(StatusCode.ERROR, "notification gateway timeout")

        time.sleep(random_latency(5, 3))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 201)


# Top-level request flows
def flow_browse_catalog():
    """User browses the product catalog."""
    tracer = tracers["frontend-web"]
    with tracer.start_as_current_span("GET /products") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_URL, "https://shop.example.com/products")
        span.set_attribute(SpanAttributes.HTTP_USER_AGENT, "Mozilla/5.0")

        gw = tracers["api-gateway"]
        with gw.start_as_current_span("GET /api/v1/products") as gw_span:
            gw_span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
            gw_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/api/v1/products")
            auth_check()
            catalog_list()
            gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)

        time.sleep(random_latency(3, 2))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def flow_view_product():
    """User views a single product."""
    tracer = tracers["frontend-web"]
    with tracer.start_as_current_span("GET /products/:id") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_URL, "https://shop.example.com/products/42")

        gw = tracers["api-gateway"]
        with gw.start_as_current_span("GET /api/v1/products/:id") as gw_span:
            gw_span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
            gw_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/api/v1/products/:id")
            auth_check()
            catalog_detail()
            gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)

        time.sleep(random_latency(3, 2))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def flow_checkout():
    """User places an order."""
    tracer = tracers["frontend-web"]
    with tracer.start_as_current_span("POST /checkout") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
        span.set_attribute(SpanAttributes.HTTP_URL, "https://shop.example.com/checkout")

        gw = tracers["api-gateway"]
        with gw.start_as_current_span("POST /api/v1/orders") as gw_span:
            gw_span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
            gw_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/api/v1/orders")
            auth_check()
            create_order()
            time.sleep(random_latency(5, 3))
            gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 201)

        time.sleep(random_latency(3, 2))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 201)


def flow_health_check():
    """Simple health ping — shallow trace."""
    tracer = tracers["api-gateway"]
    with tracer.start_as_current_span("GET /health") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/health")
        cache_lookup("health:status", hit_rate=0.95)
        time.sleep(random_latency(2, 1))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


FLOWS = [
    (flow_browse_catalog, 40),   # 40% of traffic
    (flow_view_product, 30),     # 30%
    (flow_checkout, 15),         # 15%
    (flow_health_check, 15),     # 15%
]


def pick_flow():
    roll = random.randint(1, 100)
    cumulative = 0
    for flow_fn, weight in FLOWS:
        cumulative += weight
        if roll <= cumulative:
            return flow_fn
    return FLOWS[0][0]


def main():
    setup_tracers()
    logger.info("Trace generator started — sending to %s", ENDPOINT)
    rate = float(__import__("os").environ.get("RATE", "3"))
    interval = 1.0 / rate

    while True:
        flow = pick_flow()
        try:
            flow()
        except Exception:
            logger.exception("Error in flow %s", flow.__name__)
        time.sleep(interval)


if __name__ == "__main__":
    main()
