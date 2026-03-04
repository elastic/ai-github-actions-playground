"""
Synthetic trace generator — e-commerce microservice platform.

Produces realistic hierarchical traces with:
- 12 services across 4 languages (Java, Python, Go, JavaScript)
- Service versioning, language, and environment resource attributes
- 8 user flows with weighted traffic distribution
- Varied latencies per service tier
- Realistic error patterns (payment failures, N+1 queries, timeouts,
  circuit breakers, rate limiting, deadlocks)
- HTTP, database, cache, and messaging span attributes
"""

import random
import time
import logging
import os

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.trace import StatusCode
from opentelemetry.semconv.trace import SpanAttributes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tracegen")

ENDPOINT = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "otel-collector:4317")

# ---------------------------------------------------------------------------
# Service definitions
# ---------------------------------------------------------------------------

SERVICES = {
    "frontend-web": {
        "version": "2.4.1",
        "language": "javascript",
        "environment": "production",
    },
    "api-gateway": {
        "version": "1.8.0",
        "language": "go",
        "environment": "production",
    },
    "auth-service": {
        "version": "3.1.2",
        "language": "java",
        "environment": "production",
    },
    "user-service": {
        "version": "2.0.5",
        "language": "java",
        "environment": "production",
    },
    "catalog-service": {
        "version": "1.5.3",
        "language": "python",
        "environment": "production",
    },
    "order-service": {
        "version": "4.2.0",
        "language": "java",
        "environment": "production",
    },
    "payment-service": {
        "version": "1.3.1",
        "language": "go",
        "environment": "production",
    },
    "notification-service": {
        "version": "1.1.0",
        "language": "python",
        "environment": "staging",
    },
    "recommendation-service": {
        "version": "0.9.2",
        "language": "python",
        "environment": "staging",
    },
    "checkout-service": {
        "version": "2.1.0",
        "language": "javascript",
        "environment": "production",
    },
    "postgres": {
        "version": "16.2",
        "language": None,
        "environment": "production",
    },
    "redis": {
        "version": "7.2",
        "language": None,
        "environment": "production",
    },
}

tracers = {}


def setup_tracers():
    for name, meta in SERVICES.items():
        attrs = {
            "service.name": name,
            "service.version": meta["version"],
            "deployment.environment": meta["environment"],
        }
        if meta["language"]:
            attrs["service.language.name"] = meta["language"]
        # Also set service.environment (some EDOT mappings use this)
        attrs["service.environment"] = meta["environment"]

        resource = Resource.create(attrs)
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=ENDPOINT, insecure=True))
        )
        tracers[name] = provider.get_tracer("tracegen")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def random_latency(base_ms, jitter_ms):
    return (base_ms + random.uniform(-jitter_ms, jitter_ms)) / 1000.0


def maybe_error(rate=0.05):
    return random.random() < rate


# ---------------------------------------------------------------------------
# Low-level operations
# ---------------------------------------------------------------------------


def db_query(service, operation, table, base_ms=5, jitter_ms=3):
    tracer = tracers[service]
    with tracer.start_as_current_span(f"{operation} {table}") as span:
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


def cache_set(key_pattern):
    tracer = tracers["redis"]
    with tracer.start_as_current_span(f"SET {key_pattern}") as span:
        span.set_attribute(SpanAttributes.DB_SYSTEM, "redis")
        span.set_attribute(SpanAttributes.DB_OPERATION, "SET")
        time.sleep(random_latency(1, 0.5))


# ---------------------------------------------------------------------------
# Service operations
# ---------------------------------------------------------------------------


def auth_check():
    tracer = tracers["auth-service"]
    with tracer.start_as_current_span("POST /auth/verify") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/auth/verify")

        # Check session cache, then token cache, fallback to DB
        cache_lookup("session:*")
        if not cache_lookup("token:*", hit_rate=0.9):
            db_query("postgres", "SELECT", "users")

        time.sleep(random_latency(8, 4))

        if maybe_error(0.03):
            span.set_status(StatusCode.ERROR, "token expired")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 401)
            span.set_attribute("error.type", "AuthenticationError")
        elif maybe_error(0.01):
            span.set_status(StatusCode.ERROR, "auth service unavailable")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 503)
            span.set_attribute("error.type", "ServiceUnavailableError")
        else:
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def catalog_list():
    tracer = tracers["catalog-service"]
    with tracer.start_as_current_span("GET /catalog/products") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/catalog/products")

        if not cache_lookup("catalog:products", hit_rate=0.7):
            db_query("postgres", "SELECT", "products", base_ms=12, jitter_ms=5)
            cache_set("catalog:products")
            # N+1 query pattern on cache miss
            if maybe_error(0.15):
                for _ in range(random.randint(3, 8)):
                    db_query("postgres", "SELECT", "product_images", base_ms=4, jitter_ms=2)

        time.sleep(random_latency(15, 8))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def catalog_detail():
    tracer = tracers["catalog-service"]
    product_id = random.randint(1, 500)
    with tracer.start_as_current_span("GET /catalog/products/:id") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/catalog/products/:id")
        span.set_attribute("product.id", product_id)

        if not cache_lookup(f"product:{product_id}", hit_rate=0.6):
            db_query("postgres", "SELECT", "products")
            db_query("postgres", "SELECT", "product_reviews", base_ms=8, jitter_ms=4)
            cache_set(f"product:{product_id}")

        time.sleep(random_latency(10, 5))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def catalog_search(query_term):
    tracer = tracers["catalog-service"]
    with tracer.start_as_current_span("GET /catalog/search") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/catalog/search")
        span.set_attribute("search.query", query_term)

        # Full-text search — heavier DB operation
        db_query("postgres", "SELECT", "products_fts", base_ms=25, jitter_ms=15)

        # Occasional slow query
        if maybe_error(0.03):
            time.sleep(random_latency(500, 200))
            span.set_attribute("db.slow_query", True)

        time.sleep(random_latency(20, 10))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def recommend_products():
    tracer = tracers["recommendation-service"]
    with tracer.start_as_current_span("GET /recommendations") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/recommendations")

        # Fetch user history for ML model
        db_query("postgres", "SELECT", "user_interactions", base_ms=10, jitter_ms=5)

        # ML inference — higher latency
        time.sleep(random_latency(60, 30))

        if maybe_error(0.10):
            # Model timeout — fall back to popular items
            span.set_status(StatusCode.ERROR, "model inference timeout")
            span.set_attribute("error.type", "TimeoutError")
            span.set_attribute("recommendation.fallback", True)
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)  # still returns, just degraded
            cache_lookup("popular:items", hit_rate=0.95)
        else:
            span.set_attribute("recommendation.fallback", False)
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

        # Inventory conflict
        if maybe_error(0.02):
            span.set_status(StatusCode.ERROR, "inventory conflict — item out of stock")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 409)
            span.set_attribute("error.type", "ConflictError")
            return False

        # DB deadlock
        if maybe_error(0.01):
            span.set_status(StatusCode.ERROR, "deadlock detected, transaction rolled back")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 500)
            span.set_attribute("error.type", "DeadlockError")
            return False

        db_query("postgres", "UPDATE", "inventory", base_ms=8, jitter_ms=4)
        time.sleep(random_latency(5, 3))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 201)
        return True


def process_payment():
    tracer = tracers["payment-service"]
    with tracer.start_as_current_span("POST /payments/charge") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/payments/charge")
        span.set_attribute("payment.method", random.choice(["card", "paypal", "apple_pay", "google_pay"]))

        # External gateway call — high latency
        time.sleep(random_latency(80, 40))

        if maybe_error(0.08):
            span.set_status(StatusCode.ERROR, "payment declined")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 402)
            span.set_attribute("error.type", "PaymentDeclinedError")
            return False

        if maybe_error(0.02):
            span.set_status(StatusCode.ERROR, "payment gateway timeout")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 504)
            span.set_attribute("error.type", "GatewayTimeoutError")
            return False

        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)
        return True


def send_notification(channel=None):
    tracer = tracers["notification-service"]
    ch = channel or random.choice(["email", "sms", "push"])
    with tracer.start_as_current_span("POST /notify") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/notify")
        span.set_attribute("notification.channel", ch)

        time.sleep(random_latency(20, 15))

        if maybe_error(0.05):
            span.set_status(StatusCode.ERROR, f"{ch} delivery failed")
            span.set_attribute("error.type", "DeliveryError")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 500)
        elif maybe_error(0.02):
            span.set_status(StatusCode.ERROR, "rate limited by provider")
            span.set_attribute("error.type", "RateLimitError")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 429)
        else:
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 202)


def get_user_profile():
    tracer = tracers["user-service"]
    with tracer.start_as_current_span("GET /users/:id") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/users/:id")
        span.set_attribute("user.id", random.randint(1, 10000))

        if not cache_lookup("user:profile:*", hit_rate=0.75):
            db_query("postgres", "SELECT", "users", base_ms=6, jitter_ms=3)
            db_query("postgres", "SELECT", "user_preferences", base_ms=4, jitter_ms=2)
            cache_set("user:profile:*")

        time.sleep(random_latency(8, 4))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def update_user_profile():
    tracer = tracers["user-service"]
    with tracer.start_as_current_span("PUT /users/:id") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "PUT")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/users/:id")
        span.set_attribute("user.id", random.randint(1, 10000))

        db_query("postgres", "SELECT", "users", base_ms=5, jitter_ms=2)

        # Optimistic lock retry
        if maybe_error(0.05):
            db_query("postgres", "SELECT", "users", base_ms=5, jitter_ms=2)
            db_query("postgres", "UPDATE", "users", base_ms=8, jitter_ms=4)
            span.set_attribute("db.retry_count", 1)

        db_query("postgres", "UPDATE", "users", base_ms=8, jitter_ms=4)
        time.sleep(random_latency(10, 5))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def list_orders():
    tracer = tracers["order-service"]
    with tracer.start_as_current_span("GET /orders") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/orders")

        db_query("postgres", "SELECT", "orders", base_ms=15, jitter_ms=8)
        time.sleep(random_latency(10, 5))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


# ---------------------------------------------------------------------------
# User flows
# ---------------------------------------------------------------------------

# Track consecutive payment failures for circuit breaker
_payment_failures = 0
_CIRCUIT_BREAKER_THRESHOLD = 3


def flow_browse_catalog():
    """User browses the product catalog."""
    tracer = tracers["frontend-web"]
    with tracer.start_as_current_span("GET /products") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_URL, "https://shop.example.com/products")
        span.set_attribute(SpanAttributes.HTTP_USER_AGENT, "Mozilla/5.0")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/products")

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
    """User views a product with ML recommendations."""
    tracer = tracers["frontend-web"]
    with tracer.start_as_current_span("GET /products/:id") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_URL, "https://shop.example.com/products/42")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/products/:id")

        gw = tracers["api-gateway"]
        with gw.start_as_current_span("GET /api/v1/products/:id") as gw_span:
            gw_span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
            gw_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/api/v1/products/:id")
            auth_check()
            catalog_detail()
            recommend_products()
            gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)

        time.sleep(random_latency(3, 2))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def flow_checkout():
    """User places an order — full checkout pipeline."""
    global _payment_failures
    tracer = tracers["frontend-web"]
    with tracer.start_as_current_span("POST /checkout") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
        span.set_attribute(SpanAttributes.HTTP_URL, "https://shop.example.com/checkout")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/checkout")

        gw = tracers["api-gateway"]
        with gw.start_as_current_span("POST /api/v1/checkout") as gw_span:
            gw_span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
            gw_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/api/v1/checkout")

            auth_check()

            # Checkout orchestrator
            co = tracers["checkout-service"]
            with co.start_as_current_span("POST /checkout/process") as co_span:
                co_span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
                co_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/checkout/process")

                # Circuit breaker check
                if _payment_failures >= _CIRCUIT_BREAKER_THRESHOLD:
                    co_span.set_status(StatusCode.ERROR, "circuit breaker open — payment service degraded")
                    co_span.set_attribute("error.type", "CircuitBreakerOpenError")
                    co_span.set_attribute("circuit_breaker.state", "open")
                    co_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 503)
                    _payment_failures = 0  # reset after tripping
                    gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 503)
                    span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 503)
                    return

                order_ok = create_order()
                if not order_ok:
                    co_span.set_status(StatusCode.ERROR, "order creation failed")
                    co_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 422)
                    gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 422)
                    span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 422)
                    return

                payment_ok = process_payment()
                if not payment_ok:
                    _payment_failures += 1
                    co_span.set_status(StatusCode.ERROR, "payment failed")
                    co_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 402)
                    gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 402)
                    span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 402)
                    return

                _payment_failures = 0
                send_notification("email")

                co_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 201)

            gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 201)

        time.sleep(random_latency(3, 2))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 201)


def flow_user_profile():
    """User views or updates their profile."""
    tracer = tracers["frontend-web"]
    is_update = random.random() < 0.3
    method = "PUT" if is_update else "GET"

    with tracer.start_as_current_span(f"{method} /profile") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, method)
        span.set_attribute(SpanAttributes.HTTP_URL, "https://shop.example.com/profile")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/profile")

        gw = tracers["api-gateway"]
        with gw.start_as_current_span(f"{method} /api/v1/users/:id") as gw_span:
            gw_span.set_attribute(SpanAttributes.HTTP_METHOD, method)
            gw_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/api/v1/users/:id")
            auth_check()

            if is_update:
                update_user_profile()
            else:
                get_user_profile()

            gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)

        time.sleep(random_latency(3, 2))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def flow_search():
    """User searches the catalog."""
    tracer = tracers["frontend-web"]
    queries = ["laptop", "headphones", "camera", "shoes", "backpack", "watch", "keyboard"]
    query_term = random.choice(queries)

    with tracer.start_as_current_span("GET /search") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_URL, f"https://shop.example.com/search?q={query_term}")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/search")

        gw = tracers["api-gateway"]
        with gw.start_as_current_span("GET /api/v1/catalog/search") as gw_span:
            gw_span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
            gw_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/api/v1/catalog/search")
            auth_check()
            catalog_search(query_term)
            gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)

        time.sleep(random_latency(3, 2))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def flow_health_check():
    """Simple health ping — shallow trace."""
    tracer = tracers["api-gateway"]
    with tracer.start_as_current_span("GET /health") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/health")
        cache_lookup("health:status", hit_rate=0.95)
        time.sleep(random_latency(2, 1))
        if maybe_error(0.05):
            span.set_status(StatusCode.ERROR, "redis health check failed")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 503)
        else:
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def flow_recommendation_batch():
    """Background batch job — ML recommendation model refresh."""
    tracer = tracers["recommendation-service"]
    with tracer.start_as_current_span("POST /recommendations/batch-refresh") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/recommendations/batch-refresh")

        # Fetch catalog data for model
        catalog_tracer = tracers["catalog-service"]
        with catalog_tracer.start_as_current_span("GET /catalog/export") as cat_span:
            cat_span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
            cat_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/catalog/export")
            db_query("postgres", "SELECT", "products", base_ms=30, jitter_ms=15)
            db_query("postgres", "SELECT", "user_interactions", base_ms=40, jitter_ms=20)
            cat_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)

        # ML inference — high latency batch operation
        time.sleep(random_latency(200, 100))

        if maybe_error(0.10):
            span.set_status(StatusCode.ERROR, "batch inference timeout")
            span.set_attribute("error.type", "TimeoutError")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 504)
        else:
            cache_set("recommendations:model:latest")
            span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


def flow_admin_dashboard():
    """Admin loads the dashboard — cross-service aggregation."""
    tracer = tracers["frontend-web"]
    with tracer.start_as_current_span("GET /admin/dashboard") as span:
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute(SpanAttributes.HTTP_URL, "https://shop.example.com/admin/dashboard")
        span.set_attribute(SpanAttributes.HTTP_ROUTE, "/admin/dashboard")

        gw = tracers["api-gateway"]
        with gw.start_as_current_span("GET /api/v1/admin/stats") as gw_span:
            gw_span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
            gw_span.set_attribute(SpanAttributes.HTTP_ROUTE, "/api/v1/admin/stats")
            auth_check()
            get_user_profile()
            list_orders()
            gw_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)

        time.sleep(random_latency(5, 3))
        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)


# ---------------------------------------------------------------------------
# Traffic distribution
# ---------------------------------------------------------------------------

FLOWS = [
    (flow_browse_catalog, 25),
    (flow_view_product, 20),
    (flow_checkout, 15),
    (flow_user_profile, 10),
    (flow_search, 10),
    (flow_health_check, 10),
    (flow_recommendation_batch, 5),
    (flow_admin_dashboard, 5),
]
if sum(weight for _, weight in FLOWS) != 100:
    raise ValueError("FLOWS weights must sum to 100")


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
    logger.info(
        "Services: %s", ", ".join(f"{n} ({m['language'] or 'infra'} v{m['version']})" for n, m in SERVICES.items())
    )
    rate = float(os.environ.get("TRACEGEN_RATE", os.environ.get("RATE", "3")))
    if rate <= 0:
        raise ValueError("TRACEGEN_RATE/RATE must be > 0")
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
