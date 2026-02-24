"""
Synthetic profiling data generator — bulk-indexes realistic profiling
documents into Elasticsearch's Universal Profiling indices.

Produces data compatible with the Profiling Data Explorer:
  - profiling-events-all      (sampling events)
  - profiling-stacktraces     (stacktrace → frame ID mappings)
  - profiling-stackframes     (frame → function/file/line symbols)

Uses comma-separated frame IDs matching the EDOT OTel exporter format.
"""

import hashlib
import logging
import os
import random
import time
from datetime import datetime, timezone

from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("profgen")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ES_URL = os.environ.get("ES_URL", "http://localhost:9200")
ES_API_KEY = os.environ.get("ES_API_KEY", "")
RATE = float(os.environ.get("RATE", "2"))  # batches per second

# ---------------------------------------------------------------------------
# Realistic stack frame definitions grouped by service/executable
# ---------------------------------------------------------------------------

FRAME_DEFS = [
    # --- Node.js / frontend-web ---
    {"fn": "ReactDOM.render", "file": "node_modules/react-dom/cjs/react-dom.production.min.js", "line": 245, "exe": "node"},
    {"fn": "App.componentDidMount", "file": "src/App.tsx", "line": 42, "exe": "node"},
    {"fn": "fetch", "file": "node_modules/node-fetch/lib/index.js", "line": 1489, "exe": "node"},
    {"fn": "TLSSocket._start", "file": "internal/tls/tls_wrap.js", "line": 264, "exe": "node"},
    {"fn": "HTTPParser.onHeadersComplete", "file": "_http_common.js", "line": 72, "exe": "node"},
    {"fn": "EventEmitter.emit", "file": "events.js", "line": 315, "exe": "node"},
    {"fn": "JSON.parse", "file": "<native>", "line": 0, "exe": "node"},

    # --- Node.js / api-gateway ---
    {"fn": "Express.handle", "file": "node_modules/express/lib/router/index.js", "line": 178, "exe": "node"},
    {"fn": "router.route", "file": "node_modules/express/lib/router/route.js", "line": 141, "exe": "node"},
    {"fn": "authMiddleware", "file": "src/middleware/auth.ts", "line": 23, "exe": "node"},
    {"fn": "rateLimiter", "file": "src/middleware/rateLimit.ts", "line": 15, "exe": "node"},
    {"fn": "cors", "file": "node_modules/cors/lib/index.js", "line": 50, "exe": "node"},

    # --- Java / catalog-service ---
    {"fn": "CatalogController.listProducts", "file": "com/shop/catalog/CatalogController.java", "line": 58, "exe": "java"},
    {"fn": "ProductRepository.findAll", "file": "com/shop/catalog/ProductRepository.java", "line": 34, "exe": "java"},
    {"fn": "HikariPool.getConnection", "file": "com/zaxxer/hikari/HikariPool.java", "line": 172, "exe": "java"},
    {"fn": "PreparedStatement.executeQuery", "file": "org/postgresql/jdbc/PgPreparedStatement.java", "line": 120, "exe": "java"},
    {"fn": "SpringApplication.run", "file": "org/springframework/boot/SpringApplication.java", "line": 316, "exe": "java"},
    {"fn": "DispatcherServlet.doDispatch", "file": "org/springframework/web/servlet/DispatcherServlet.java", "line": 1067, "exe": "java"},
    {"fn": "JacksonObjectMapper.writeValue", "file": "com/fasterxml/jackson/databind/ObjectMapper.java", "line": 3213, "exe": "java"},

    # --- Java / order-service ---
    {"fn": "OrderController.createOrder", "file": "com/shop/order/OrderController.java", "line": 45, "exe": "java"},
    {"fn": "OrderService.processOrder", "file": "com/shop/order/OrderService.java", "line": 72, "exe": "java"},
    {"fn": "InventoryClient.checkStock", "file": "com/shop/order/InventoryClient.java", "line": 31, "exe": "java"},
    {"fn": "TransactionManager.commit", "file": "org/springframework/transaction/support/AbstractPlatformTransactionManager.java", "line": 734, "exe": "java"},

    # --- Python / payment-service ---
    {"fn": "charge_card", "file": "payment/handlers.py", "line": 67, "exe": "python3"},
    {"fn": "validate_card_number", "file": "payment/validators.py", "line": 23, "exe": "python3"},
    {"fn": "stripe.Charge.create", "file": "stripe/api_resources/charge.py", "line": 45, "exe": "python3"},
    {"fn": "requests.post", "file": "requests/api.py", "line": 119, "exe": "python3"},
    {"fn": "urllib3.HTTPSConnectionPool.urlopen", "file": "urllib3/connectionpool.py", "line": 715, "exe": "python3"},
    {"fn": "ssl.SSLSocket.do_handshake", "file": "ssl.py", "line": 1342, "exe": "python3"},

    # --- PostgreSQL / postgres ---
    {"fn": "ExecScan", "file": "src/backend/executor/execScan.c", "line": 95, "exe": "postgres"},
    {"fn": "heapam_scan_getnextslot", "file": "src/backend/access/heap/heapam.c", "line": 1078, "exe": "postgres"},
    {"fn": "ExecSeqScan", "file": "src/backend/executor/nodeSeqscan.c", "line": 112, "exe": "postgres"},
    {"fn": "BufferAlloc", "file": "src/backend/storage/buffer/bufmgr.c", "line": 320, "exe": "postgres"},
    {"fn": "ReadBuffer_common", "file": "src/backend/storage/buffer/bufmgr.c", "line": 645, "exe": "postgres"},
    {"fn": "XLogInsertRecord", "file": "src/backend/access/transam/xloginsert.c", "line": 474, "exe": "postgres"},
    {"fn": "LWLockAcquire", "file": "src/backend/storage/lmgr/lwlock.c", "line": 1173, "exe": "postgres"},
    {"fn": "hash_search_with_hash_value", "file": "src/backend/utils/hash/dynahash.c", "line": 952, "exe": "postgres"},
]

# Service → executable mapping
SERVICE_EXECUTABLES = {
    "frontend-web": "node",
    "api-gateway": "node",
    "catalog-service": "java",
    "order-service": "java",
    "payment-service": "python3",
    "postgres": "postgres",
}

# Service → which frame indices to draw from (by executable)
SERVICE_FRAME_INDICES = {}

# Thread names per executable
THREAD_NAMES = {
    "node": ["main", "WorkerThread-1", "WorkerThread-2", "libuv-worker"],
    "java": ["main", "http-nio-8080-exec-1", "http-nio-8080-exec-2", "HikariPool-1-connection", "scheduling-1"],
    "python3": ["MainThread", "ThreadPoolExecutor-0_0", "ThreadPoolExecutor-0_1"],
    "postgres": ["postmaster", "bgwriter", "walwriter", "autovacuum launcher", "postgres: user appdb"],
}

HOST_NAMES = ["worker-01", "worker-02", "worker-03"]


def _frame_id(fn: str, file: str, line: int) -> str:
    """Deterministic 32-char hex frame ID from function+file+line."""
    h = hashlib.md5(f"{fn}:{file}:{line}".encode()).hexdigest()
    return h


def _stacktrace_id(frame_ids: list[str]) -> str:
    """Deterministic base64-like stacktrace ID from frame ID list."""
    h = hashlib.sha256(",".join(frame_ids).encode()).hexdigest()[:24]
    return h


# ---------------------------------------------------------------------------
# Build frame and stacktrace catalogs
# ---------------------------------------------------------------------------

FRAMES: dict[str, dict] = {}
for fdef in FRAME_DEFS:
    fid = _frame_id(fdef["fn"], fdef["file"], fdef["line"])
    FRAMES[fid] = {
        "id": fid,
        "function_name": fdef["fn"],
        "file_name": fdef["file"],
        "line_number": fdef["line"],
        "function_offset": random.randint(0, 64),
        "exe": fdef["exe"],
    }

# Group frame IDs by executable
EXE_FRAME_IDS: dict[str, list[str]] = {}
for fid, fdata in FRAMES.items():
    exe = fdata["exe"]
    EXE_FRAME_IDS.setdefault(exe, []).append(fid)


def _build_stacktrace(service: str) -> tuple[str, list[str]]:
    """Build a random stacktrace for a service, 3-7 frames deep."""
    exe = SERVICE_EXECUTABLES[service]
    pool = EXE_FRAME_IDS[exe]
    depth = random.randint(3, min(7, len(pool)))
    selected = random.sample(pool, depth)
    stid = _stacktrace_id(selected)
    return stid, selected


# Pre-generate a catalog of stacktraces per service
STACKTRACE_CATALOG: dict[str, list[tuple[str, list[str]]]] = {}
for svc in SERVICE_EXECUTABLES:
    STACKTRACE_CATALOG[svc] = [_build_stacktrace(svc) for _ in range(5)]

ALL_STACKTRACES: dict[str, list[str]] = {}
for svc, traces in STACKTRACE_CATALOG.items():
    for stid, fids in traces:
        ALL_STACKTRACES[stid] = fids


# ---------------------------------------------------------------------------
# Index template bootstrapping
# ---------------------------------------------------------------------------

INDEX_TEMPLATES = {
    "profiling-events-all": {
        "mappings": {
            "properties": {
                "@timestamp": {"type": "date"},
                "ecs.version": {"type": "keyword"},
                "host.id": {"type": "keyword"},
                "host.name": {"type": "keyword"},
                "Stacktrace.id": {"type": "keyword"},
                "Stacktrace.count": {"type": "integer"},
                "service.name": {"type": "keyword"},
                "process.thread.name": {"type": "keyword"},
                "process.executable.name": {"type": "keyword"},
            }
        }
    },
    "profiling-stacktraces": {
        "mappings": {
            "properties": {
                "ecs.version": {"type": "keyword"},
                "Stacktrace.frame.ids": {"type": "keyword"},
                "Stacktrace.frame.types": {"type": "keyword"},
            }
        }
    },
    "profiling-stackframes": {
        "mappings": {
            "properties": {
                "ecs.version": {"type": "keyword"},
                "Stackframe.function.name": {"type": "keyword"},
                "Stackframe.file.name": {"type": "keyword"},
                "Stackframe.line.number": {"type": "integer"},
                "Stackframe.function.offset": {"type": "integer"},
            }
        }
    },
}


def ensure_indices(es: Elasticsearch) -> None:
    """Create profiling indices if they don't already exist."""
    for index_name, body in INDEX_TEMPLATES.items():
        if not es.indices.exists(index=index_name):
            logger.info("Creating index %s", index_name)
            es.indices.create(index=index_name, **body)
        else:
            logger.info("Index %s already exists", index_name)


def seed_static_data(es: Elasticsearch) -> None:
    """Bulk-index stacktraces and stackframes (idempotent via doc IDs)."""
    actions = []

    # Stackframes
    for fid, fdata in FRAMES.items():
        actions.append({
            "_index": "profiling-stackframes",
            "_id": fid,
            "_source": {
                "ecs.version": "1.12.0",
                "Stackframe.function.name": [fdata["function_name"]],
                "Stackframe.file.name": [fdata["file_name"]],
                "Stackframe.line.number": [fdata["line_number"]],
                "Stackframe.function.offset": [fdata["function_offset"]],
            },
        })

    # Stacktraces
    for stid, fids in ALL_STACKTRACES.items():
        actions.append({
            "_index": "profiling-stacktraces",
            "_id": stid,
            "_source": {
                "ecs.version": "1.12.0",
                "Stacktrace.frame.ids": ",".join(fids),
                "Stacktrace.frame.types": "",
            },
        })

    if actions:
        success, errors = bulk(es, actions, raise_on_error=False)
        logger.info(
            "Seeded %d stackframes + %d stacktraces (%d ok, %d errors)",
            len(FRAMES), len(ALL_STACKTRACES), success, len(errors),
        )


# ---------------------------------------------------------------------------
# Continuous event generation
# ---------------------------------------------------------------------------

def generate_event_batch(batch_size: int = 20) -> list[dict]:
    """Generate a batch of profiling events across all services."""
    now = datetime.now(timezone.utc)
    events = []

    for _ in range(batch_size):
        service = random.choice(list(SERVICE_EXECUTABLES.keys()))
        exe = SERVICE_EXECUTABLES[service]
        stid, _ = random.choice(STACKTRACE_CATALOG[service])
        thread = random.choice(THREAD_NAMES[exe])
        host = random.choice(HOST_NAMES)

        events.append({
            "_index": "profiling-events-all",
            "_source": {
                "@timestamp": now.isoformat(),
                "ecs.version": "1.12.0",
                "host.id": hashlib.md5(host.encode()).hexdigest()[:12],
                "host.name": host,
                "Stacktrace.id": stid,
                "Stacktrace.count": random.randint(1, 50),
                "service.name": service,
                "process.thread.name": thread,
                "process.executable.name": exe,
            },
        })

    return events


def main() -> None:
    logger.info("Connecting to Elasticsearch at %s", ES_URL)

    client_kwargs: dict = {"hosts": [ES_URL], "request_timeout": 30}
    if ES_API_KEY:
        client_kwargs["api_key"] = ES_API_KEY

    es = Elasticsearch(**client_kwargs)

    # Wait for ES to be ready
    for attempt in range(30):
        try:
            info = es.info()
            logger.info("Connected to ES %s", info["version"]["number"])
            break
        except Exception:
            logger.info("Waiting for Elasticsearch... (attempt %d)", attempt + 1)
            time.sleep(2)
    else:
        logger.error("Could not connect to Elasticsearch")
        return

    ensure_indices(es)
    seed_static_data(es)

    interval = 1.0 / RATE
    logger.info("Generating profiling events at %.1f batches/sec", RATE)

    while True:
        try:
            batch = generate_event_batch()
            success, errors = bulk(es, batch, raise_on_error=False)
            if errors:
                logger.warning("Bulk errors: %d", len(errors))
        except Exception:
            logger.exception("Error sending batch")
        time.sleep(interval)


if __name__ == "__main__":
    main()
