PEEK_DIR := peek

.PHONY: help setup serve serve-proxy build lint format ci check clean preview test test-unit test-unit-coverage test-integration test-e2e docker-build docker-run electron-dev electron-build electron-dist
.PHONY: help setup serve serve-proxy build lint format ci check clean preview test test-unit test-unit-coverage test-integration test-e2e docker-build docker-run otel-up otel-down otel-logs otel-cloud-up otel-cloud-down otel-cloud-logs fleet-harness-up fleet-harness-down fleet-harness-logs electron-dev electron-build electron-dist

help:
	@echo "Elastic Peek — a static dashboarding tool powered by Perses + ES|QL"
	@echo ""
	@echo "Available targets:"
	@echo "  setup            - Install Node.js dependencies"
	@echo "  serve            - Install deps + start Vite dev server (http://localhost:3000)"
	@echo "  serve-proxy      - Install deps + start dev server with Elasticsearch proxy (set ES_URL)"
	@echo "  build            - Production build to peek/dist/"
	@echo "  preview          - Build then preview locally"
	@echo "  lint             - Prettier format check + ESLint + TypeScript type check"
	@echo "  format           - Auto-format code with Prettier"
	@echo "  ci               - npm ci + lint + unit tests + build (strict lockfile)"
	@echo "  check            - Alias for ci"
	@echo "  test             - Run all tests (unit, integration, e2e)"
	@echo "  test-unit        - Run unit tests"
	@echo "  test-unit-coverage - Run unit/component tests with coverage thresholds"
	@echo "  test-integration - Run integration tests"
	@echo "  test-e2e         - Run end-to-end tests"
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
	@echo "  fleet-harness-up - Start Fleet Server + enrolled agents harness"
	@echo "  fleet-harness-down - Stop and remove Fleet harness"
	@echo "  fleet-harness-logs - Tail Fleet Server logs"

setup:
	@echo "Installing dependencies..."
	@cd $(PEEK_DIR) && npm install
	@echo ""
	@echo "✓ Setup complete! Run 'make serve' to start developing."

serve: setup
	@cd $(PEEK_DIR) && npm run dev

serve-proxy: setup
	@echo "Starting dev server with Elasticsearch proxy..."
	@echo "  ES_URL from environment or .env: $${ES_URL:-<loaded from .env>}"
	@echo "  Enter http://localhost:3000/_es as the Elasticsearch URL"
	@cd $(PEEK_DIR) && npm run dev

build:
	@echo "Building for production..."
	@cd $(PEEK_DIR) && npm run build
	@echo ""
	@echo "✓ Build complete: $(PEEK_DIR)/dist/"

preview: setup build
	@cd $(PEEK_DIR) && npm run preview

lint:
	@echo "Running Prettier format check..."
	@cd $(PEEK_DIR) && npx prettier --check src
	@echo ""
	@echo "Running ESLint..."
	@cd $(PEEK_DIR) && npx eslint src
	@echo ""
	@echo "Running TypeScript type check..."
	@cd $(PEEK_DIR) && npx tsc --noEmit
	@echo ""
	@echo "✓ All checks passed."

format:
	@echo "Formatting code with Prettier..."
	@cd $(PEEK_DIR) && npx prettier --write src
	@echo ""
	@echo "✓ Formatting complete."

ci:
	@echo "Installing dependencies (strict lockfile)..."
	@cd $(PEEK_DIR) && npm ci
	@$(MAKE) lint test-unit-coverage build
	@echo ""
	@echo "✓ CI passed: lint + coverage gate + build all green."

check: ci

test: test-unit test-integration test-e2e

test-unit:
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
	@echo "  Connect the dashboard to: http://localhost:8080"
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
	@echo "Connect Peek to: http://localhost:9220 with user 'elastic', password 'changeme'"

fleet-harness-down:
	@echo "Stopping Fleet Server harness..."
	@docker compose -f docker-compose.fleet-harness.yml down -v
	@echo "✓ Fleet harness stopped."

fleet-harness-logs:
	@docker compose -f docker-compose.fleet-harness.yml logs -f fleet-server
