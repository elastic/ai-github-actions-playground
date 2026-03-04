PEEK_DIR := peek

# Base ref for changed-file targets (override: make lint BASE=HEAD~3)
BASE ?= main

.PHONY: help setup serve serve-proxy serve-background serve-explore explore-down build lint lint-full format format-full ci check clean preview test test-unit test-unit-full test-unit-coverage test-integration test-e2e test-e2e-preview docker-build docker-run electron-dev electron-build electron-dist
.PHONY: otel-up otel-down otel-logs otel-cloud-up otel-cloud-down otel-cloud-logs otel-profiling-up otel-profiling-down otel-profiling-logs profiling-seed fleet-harness-up fleet-harness-down fleet-harness-logs
.PHONY: seed-es screenshot-all test-e2e-live otel-capture otel-capture-down otel-replay-up otel-replay otel-replay-down

help:
	@echo "Elastic Peek — a static dashboarding tool powered by Perses + ES|QL"
	@echo ""
	@echo "Available targets:"
	@echo "  setup            - Install Node.js dependencies"
	@echo "  serve            - Install deps + start Vite dev server (http://localhost:3000)"
	@echo "  serve-proxy      - Install deps + start dev server with Elasticsearch proxy (set ES_URL)"
	@echo "  serve-background - Start dev server in background and wait until ready"
	@echo "  serve-explore    - Start ES + seed data + dev server (for explore agents)"
	@echo "  explore-down     - Stop the exploration stack (ES + dev server)"
	@echo "  build            - Production build to peek/dist/"
	@echo "  preview          - Build then preview locally"
	@echo "  lint             - Prettier + ESLint on changed files + full TypeScript type check (fast default)"
	@echo "  lint-full        - Prettier + ESLint + TypeScript type check on all files"
	@echo "  format           - Auto-format changed files with Prettier"
	@echo "  format-full      - Auto-format all files with Prettier"
	@echo "  ci               - npm ci + lint + unit tests + build (strict lockfile)"
	@echo "  check            - Alias for ci"
	@echo "  test             - Run all tests (unit, integration, e2e)"
	@echo "  test-unit        - Run unit tests related to files changed since BASE (fast default)"
	@echo "  test-unit-full   - Run all unit tests"
	@echo "  test-unit-coverage - Run unit/component tests with coverage thresholds"
	@echo "  test-integration - Run integration tests"
	@echo "  test-e2e         - Run end-to-end tests"
	@echo "  test-e2e-preview - Run e2e tests against production build (catches bundle issues)"
	@echo "  test-e2e-live    - Run live ES end-to-end tests (set ES_URL)"
	@echo "  seed-es          - Seed Elasticsearch with non-OTLP test data (set ES_URL)"
	@echo "  screenshot-all   - Capture all page screenshots (mocked data)"
	@echo "  otel-capture     - Capture OTLP fixtures from live OTel stack"
	@echo "  otel-capture-down - Stop the OTel capture stack"
	@echo "  otel-replay-up   - Start ES + collector in replay mode"
	@echo "  otel-replay      - Replay OTLP fixtures + seed non-OTLP data"
	@echo "  otel-replay-down - Stop the replay stack"
	@echo "  clean            - Remove build artifacts and node_modules"
	@echo "  docker-build     - Build the Docker image"
	@echo "  docker-run       - Run the Docker container (set ES_URL)"
	@echo "  electron-dev     - Start Electron app in dev mode (hot-reloads)"
	@echo "  electron-build   - Build Electron app (renderer + main process)"
	@echo "  electron-dist    - Package Electron app for distribution"
	@echo "  otel-up          - Start local ES + EDOT collector + telemetry generators"
	@echo "  otel-down        - Stop and remove local OTel stack"
	@echo "  otel-logs        - Tail EDOT collector logs"
	@echo "  otel-cloud-up    - Send OTel data to a remote cluster (set ES_URL, ES_API_KEY)"
	@echo "  otel-cloud-down  - Stop remote OTel stack"
	@echo "  otel-cloud-logs  - Tail remote EDOT collector logs"
	@echo "  otel-profiling-up  - Start local ES + EDOT + eBPF profiler + synthetic profgen"
	@echo "  otel-profiling-down - Stop profiling stack"
	@echo "  otel-profiling-logs - Tail EDOT collector logs (profiling stack)"
	@echo "  profiling-seed     - Run synthetic profiling data seeder once then exit"
	@echo "  fleet-harness-up - Start Fleet Server + enrolled agents harness"
	@echo "  fleet-harness-down - Stop and remove Fleet harness"
	@echo "  fleet-harness-logs - Tail Fleet Server logs"

setup:
	@echo "Installing dependencies..."
	@cd $(PEEK_DIR) && npm ci
	@echo ""
	@echo "✓ Setup complete! Run 'make serve' to start developing."

serve: setup
	@cd $(PEEK_DIR) && npm run dev

serve-proxy: setup
	@echo "Starting dev server with Elasticsearch proxy..."
	@echo "  ES_URL from environment or .env: $${ES_URL:-<loaded from .env>}"
	@echo "  Enter http://localhost:3000/_es as the Elasticsearch URL"
	@cd $(PEEK_DIR) && npm run dev

serve-background: setup
	@echo "Starting Vite dev server in background..."
	@cd $(PEEK_DIR) && { nohup npx vite --host 127.0.0.1 > /tmp/vite-dev-server.log 2>&1 & echo $$! > /tmp/vite-dev-server.pid; }
	@for i in $$(seq 1 30); do \
		curl -sf http://127.0.0.1:3000/ >/dev/null 2>&1 && break; \
		sleep 2; \
	done
	@if curl -sf http://127.0.0.1:3000/ >/dev/null 2>&1; then \
		echo "✓ Dev server running at http://localhost:3000 (PID: $$(cat /tmp/vite-dev-server.pid))"; \
	else \
		echo "✗ Dev server failed to start. Logs:"; cat /tmp/vite-dev-server.log; exit 1; \
	fi

serve-explore: setup
	@echo "Starting Elasticsearch..."
	@docker compose -f docker-compose.otel-es.yml -f docker-compose.otel-replay.yml up -d
	@echo "Waiting for Elasticsearch to be ready..."
	@for i in $$(seq 1 60); do \
		curl -sf http://localhost:9200 >/dev/null 2>&1 && break; \
		sleep 2; \
	done
	@if ! curl -sf http://localhost:9200 >/dev/null 2>&1; then \
		echo "✗ Elasticsearch failed to start. Logs:"; \
		docker compose -f docker-compose.otel-es.yml -f docker-compose.otel-replay.yml logs elasticsearch; \
		exit 1; \
	fi
	@echo "✓ Elasticsearch ready at http://localhost:9200"
	@echo "Replaying OTel fixtures + seeding data..."
	@cd $(PEEK_DIR) && node scripts/otel-replay.mjs
	@cd $(PEEK_DIR) && node scripts/seed-elasticsearch.mjs --url http://localhost:9200 --wait-for-ready
	@echo "Waiting for seeded data to be searchable..."
	@for i in $$(seq 1 30); do \
		curl -sf 'http://localhost:9200/web_logs/_count' | grep -Eq '"count":[[:space:]]*[1-9][0-9]*' && break; \
		sleep 2; \
	done
	@curl -sf 'http://localhost:9200/web_logs/_count' | grep -Eq '"count":[[:space:]]*[1-9][0-9]*' \
		|| { echo "✗ Seed verification failed: web_logs has zero docs"; exit 1; }
	@echo "✓ Data seeded and verified"
	@echo "Starting dev server..."
	@if [ -f /tmp/vite-dev-server.pid ]; then \
		old_pid=$$(cat /tmp/vite-dev-server.pid); \
		if kill -0 $$old_pid 2>/dev/null && ps -p $$old_pid -o command= 2>/dev/null | grep -q 'vite'; then \
			kill $$old_pid 2>/dev/null; \
			sleep 1; \
		fi; \
		rm -f /tmp/vite-dev-server.pid; \
	fi
	@cd $(PEEK_DIR) && { nohup npx vite --host 127.0.0.1 > /tmp/vite-dev-server.log 2>&1 & echo $$! > /tmp/vite-dev-server.pid; }
	@for i in $$(seq 1 30); do \
		curl -sf http://127.0.0.1:3000/ >/dev/null 2>&1 && break; \
		sleep 2; \
	done
	@if curl -sf http://127.0.0.1:3000/ >/dev/null 2>&1; then \
		echo "✓ Dev server running at http://localhost:3000 (PID: $$(cat /tmp/vite-dev-server.pid))"; \
	else \
		echo "✗ Dev server failed to start. Logs:"; cat /tmp/vite-dev-server.log; exit 1; \
	fi
	@echo ""
	@echo "✓ Ready for exploration!"
	@echo "  App:    http://localhost:3000/ai-github-actions-playground/"
	@echo "  ES URL: http://localhost:9200 (enter this in the connection dialog)"

explore-down:
	@echo "Stopping exploration stack..."
	@if [ -f /tmp/vite-dev-server.pid ]; then \
		pid=$$(cat /tmp/vite-dev-server.pid); \
		if kill -0 $$pid 2>/dev/null && ps -p $$pid -o command= 2>/dev/null | grep -q 'vite'; then kill $$pid; fi; \
		rm -f /tmp/vite-dev-server.pid; \
	fi
	@docker compose -f docker-compose.otel-es.yml -f docker-compose.otel-replay.yml down -v
	@echo "✓ Stopped."

build:
	@echo "Building for production..."
	@cd $(PEEK_DIR) && npm run build
	@echo ""
	@echo "✓ Build complete: $(PEEK_DIR)/dist/"

preview: setup build
	@cd $(PEEK_DIR) && npm run preview

lint:
	@echo "Detecting changed files against '$(BASE)'..."
	@CHANGED=$$(cd $(PEEK_DIR) && git diff --name-only --diff-filter=ACMR --relative $(BASE) -- 'src' | grep -E '\.(ts|tsx|js|jsx)$$' || true); \
	if [ -n "$$CHANGED" ]; then \
		echo "Running Prettier format check on changed files..."; \
		(cd $(PEEK_DIR) && echo "$$CHANGED" | tr '\n' '\0' | xargs -0 npx prettier --check) && \
		echo "" && \
		echo "Running ESLint on changed files..." && \
		(cd $(PEEK_DIR) && echo "$$CHANGED" | tr '\n' '\0' | xargs -0 npx eslint --cache --cache-location .eslintcache); \
	else \
		echo "No changed source files found — skipping Prettier and ESLint."; \
	fi
	@echo ""
	@echo "Running TypeScript type check (full project)..."
	@cd $(PEEK_DIR) && npx tsc --noEmit
	@echo ""
	@echo "✓ All checks passed."

lint-full:
	@echo "Running Prettier format check..."
	@cd $(PEEK_DIR) && npx prettier --check src
	@echo ""
	@echo "Running ESLint..."
	@cd $(PEEK_DIR) && npx eslint src --cache --cache-location .eslintcache
	@echo ""
	@echo "Running TypeScript type check..."
	@cd $(PEEK_DIR) && npx tsc --noEmit
	@echo ""
	@echo "✓ All checks passed."

format:
	@echo "Detecting changed files against '$(BASE)'..."
	@CHANGED=$$(cd $(PEEK_DIR) && git diff --name-only --diff-filter=ACMR --relative $(BASE) -- 'src' | grep -E '\.(ts|tsx|js|jsx|json|css|scss|md|markdown|html|yml|yaml)$$' || true); \
	if [ -n "$$CHANGED" ]; then \
		echo "Formatting changed files..."; \
		(cd $(PEEK_DIR) && echo "$$CHANGED" | tr '\n' '\0' | xargs -0 npx prettier --write); \
		echo "✓ Formatting complete."; \
	else \
		echo "No changed source files to format."; \
	fi

format-full:
	@echo "Formatting code with Prettier..."
	@cd $(PEEK_DIR) && npx prettier --write src
	@echo ""
	@echo "✓ Formatting complete."

ci:
	@echo "Installing dependencies (strict lockfile)..."
	@cd $(PEEK_DIR) && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
	@$(MAKE) lint-full test-unit-full build
	@echo ""
	@echo "✓ CI passed: full lint + full unit tests + build all passed."

check: ci

test-unit:
	@echo "Running unit tests for changed files (against $(BASE))..."
	@echo "Note: coverage thresholds are intentionally skipped for incremental PR runs."
	@cd $(PEEK_DIR) && npx vitest run --config vitest.config.ts --changed $(BASE) --passWithNoTests

test: test-unit-full test-integration test-e2e

test-unit-full:
	@echo "Running unit tests..."
	@cd $(PEEK_DIR) && npm run test:unit

test-unit-coverage:
	@echo "Running unit/component tests with coverage..."
	@cd $(PEEK_DIR) && npm run test:coverage

test-integration:
	@echo "Running integration tests..."
	@cd $(PEEK_DIR) && npm run test:integration

test-e2e:
	@echo "Running e2e tests..."
	@cd $(PEEK_DIR) && npm run test:e2e

test-e2e-preview: build
	@echo "Running e2e tests against production build (vite preview)..."
	@cd $(PEEK_DIR) && PLAYWRIGHT_PREVIEW=1 npx playwright test

test-e2e-live:
	@echo "Running live ES end-to-end tests..."
	@cd $(PEEK_DIR) && ES_URL=$${ES_URL:-http://localhost:9200} npx playwright test tests/e2e/smoke-live-es.spec.ts --project=chromium --reporter=list

seed-es:
	@echo "Seeding Elasticsearch at $${ES_URL:-http://localhost:9200}..."
	@cd $(PEEK_DIR) && node scripts/seed-elasticsearch.mjs --url "$${ES_URL:-http://localhost:9200}" --wait-for-ready
	@echo "✓ Elasticsearch seeded."

screenshot-all:
	@echo "Capturing all page screenshots (mocked)..."
	@cd $(PEEK_DIR) && node scripts/screenshot-all.mjs --out-dir screenshots
	@echo "✓ Screenshots saved to $(PEEK_DIR)/screenshots/"

otel-capture:
	@echo "Starting OTel stack with OTLP file capture..."
	@rm -f $(PEEK_DIR)/fixtures/otlp/*.jsonl $(PEEK_DIR)/fixtures/otlp/*.jsonl.gz
	@mkdir -p $(PEEK_DIR)/fixtures/otlp
	@docker compose -f docker-compose.otel.yml -f docker-compose.otel-es.yml -f docker-compose.otel-capture.yml up -d
	@echo "✓ Capturing to $(PEEK_DIR)/fixtures/otlp/*.jsonl"
	@echo "  Let it run ~30s, then 'make otel-capture-down' and commit the fixtures."

otel-capture-down:
	@echo "Stopping OTel capture stack..."
	@docker compose -f docker-compose.otel.yml -f docker-compose.otel-es.yml -f docker-compose.otel-capture.yml down -v
	@echo "Compressing fixtures..."
	@cd $(PEEK_DIR)/fixtures/otlp && for f in traces.jsonl metrics.jsonl logs.jsonl; do [ -f "$$f" ] && gzip -f "$$f"; done
	@echo "✓ Capture stopped. Fixtures in $(PEEK_DIR)/fixtures/otlp/*.gz"

otel-replay-up:
	@echo "Starting ES + EDOT collector in replay mode..."
	@docker compose -f docker-compose.otel-es.yml -f docker-compose.otel-replay.yml up -d
	@echo "✓ Replay stack running. Collector OTLP/HTTP: http://localhost:4318, ES: http://localhost:9200"

otel-replay:
	@echo "Replaying OTLP fixtures + seeding non-OTLP data..."
	@cd $(PEEK_DIR) && node scripts/otel-replay.mjs
	@cd $(PEEK_DIR) && node scripts/seed-elasticsearch.mjs --url "$${ES_URL:-http://localhost:9200}" --wait-for-ready
	@sleep 5  # allow collector to flush replayed data to ES
	@echo "✓ Data replayed and seeded."

otel-replay-down:
	@echo "Stopping replay stack..."
	@docker compose -f docker-compose.otel-es.yml -f docker-compose.otel-replay.yml down -v
	@echo "✓ Stopped."

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(PEEK_DIR)/dist $(PEEK_DIR)/dist-electron $(PEEK_DIR)/dist-packages $(PEEK_DIR)/node_modules
	@echo "✓ Clean complete."

docker-build:
	@echo "Building Docker image..."
	@docker build -t elastic-peek .
	@echo "✓ Docker image built. Run 'make docker-run' to start the container."

docker-run:
	@echo "Starting Docker container..."
	@echo "  Dashboard: http://localhost:8080"
	@echo "  Proxying /_es/* → $${ES_URL:-http://host.docker.internal:9200}"
	@echo "  Connect the dashboard to Elasticsearch at: http://localhost:8080/_es"
	@docker run --rm -p 8080:80 -e ES_URL=$${ES_URL:-http://host.docker.internal:9200} elastic-peek

electron-dev: setup
	@echo "Starting Elastic Peek in Electron (dev mode)..."
	@cd $(PEEK_DIR) && npm run electron:dev

electron-build: setup
	@echo "Building Elastic Peek for Electron..."
	@cd $(PEEK_DIR) && npm run electron:build
	@echo ""
	@echo "✓ Electron build complete: $(PEEK_DIR)/dist/ and $(PEEK_DIR)/dist-electron/"

electron-dist: setup
	@echo "Packaging Elastic Peek as distributable Electron app..."
	@cd $(PEEK_DIR) && npm run electron:dist
	@echo ""
	@echo "✓ Distribution packages written to $(PEEK_DIR)/dist-packages/"

otel-up:
	@echo "Starting local ES + EDOT collector + telemetry generators..."
	@docker compose -f docker-compose.otel.yml -f docker-compose.otel-es.yml up -d
	@echo "✓ Stack running. Elasticsearch: http://localhost:9200"

otel-down:
	@echo "Stopping local OTel stack..."
	@docker compose -f docker-compose.otel.yml -f docker-compose.otel-es.yml down -v
	@echo "✓ Stopped."

otel-logs:
	@docker compose -f docker-compose.otel.yml -f docker-compose.otel-es.yml logs -f otel-collector

otel-cloud-up:
	@echo "Starting EDOT collector + telemetry generators → remote cluster..."
	@docker compose -f docker-compose.otel.yml up -d
	@echo "✓ Sending traces, metrics, and logs to $${ES_URL}"

otel-cloud-down:
	@echo "Stopping remote OTel stack..."
	@docker compose -f docker-compose.otel.yml down -v
	@echo "✓ Stopped."

otel-cloud-logs:
	@docker compose -f docker-compose.otel.yml logs -f otel-collector

otel-profiling-up:
	@echo "Starting local ES + EDOT collector + eBPF profiler + synthetic profgen..."
	@echo "  Note: eBPF profiler requires Linux kernel 5.4+. On macOS it profiles the Docker VM."
	@docker compose -f docker-compose.otel.yml -f docker-compose.otel-es.yml -f docker-compose.otel-profiling.yml up -d
	@echo "✓ Profiling stack running. Elasticsearch: http://localhost:9200"

otel-profiling-down:
	@echo "Stopping profiling stack..."
	@docker compose -f docker-compose.otel.yml -f docker-compose.otel-es.yml -f docker-compose.otel-profiling.yml down -v
	@echo "✓ Stopped."

otel-profiling-logs:
	@docker compose -f docker-compose.otel.yml -f docker-compose.otel-es.yml -f docker-compose.otel-profiling.yml logs -f otel-collector

profiling-seed:
	@echo "Running synthetic profiling data seeder..."
	@docker compose -f docker-compose.otel.yml -f docker-compose.otel-es.yml -f docker-compose.otel-profiling.yml run --rm -e MAX_BATCHES=1 profgen
	@echo "✓ Profiling data seeded."

fleet-harness-up:
	@echo "Starting Fleet Server harness (ES + Kibana + Fleet Server + 2 agents)..."
	@echo "  This takes 3-5 minutes for all services to initialize."
	@docker compose -f docker-compose.fleet-harness.yml up -d
	@echo ""
	@echo "Services:"
	@echo "  Elasticsearch: http://localhost:9220  (elastic / changeme)"
	@echo "  Kibana:        http://localhost:5601   (elastic / changeme)"
	@echo "  Fleet Server:  http://localhost:8220"
	@echo ""
	@echo Connect Peek to: http://localhost:9220 with user 'elastic', password 'changeme'

fleet-harness-down:
	@echo "Stopping Fleet Server harness..."
	@docker compose -f docker-compose.fleet-harness.yml down -v
	@echo "✓ Fleet harness stopped."

fleet-harness-logs:
	@docker compose -f docker-compose.fleet-harness.yml logs -f fleet-server
