PEEK_DIR := peek

.PHONY: help setup serve serve-proxy build lint format ci check clean preview test test-unit test-unit-coverage test-integration test-e2e docker-build docker-run
.PHONY: help setup serve serve-proxy build lint format ci check clean preview test test-unit test-unit-coverage test-integration test-e2e docker-build docker-run otel-harness-up otel-harness-down otel-harness-logs otel-cloud-up otel-cloud-down otel-cloud-logs

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
	@echo "  otel-harness-up  - Start Elasticsearch + OTel host metrics harness"
	@echo "  otel-harness-down - Stop and remove OTel host metrics harness"
	@echo "  otel-harness-logs - Tail OTel collector logs"
	@echo "  otel-cloud-up    - Send OTel data to a remote Elastic cluster (set ES_URL, ES_API_KEY)"
	@echo "  otel-cloud-down  - Stop remote OTel harness"
	@echo "  otel-cloud-logs  - Tail remote OTel collector logs"

setup:
	@echo "Installing dependencies..."
	@cd $(PEEK_DIR) && npm install
	@echo ""
	@echo "✓ Setup complete! Run 'make serve' to start developing."

serve: setup
	@cd $(PEEK_DIR) && npm run dev

serve-proxy: setup
	@echo "Starting dev server with Elasticsearch proxy..."
	@echo "  Proxying /_es/* and /_query → $${ES_URL:-http://localhost:9200}"
	@echo "  Enter http://localhost:3000/_es as the Elasticsearch URL"
	@cd $(PEEK_DIR) && ES_URL=$${ES_URL:-http://localhost:9200} npm run dev

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
	@rm -rf $(PEEK_DIR)/dist $(PEEK_DIR)/node_modules
	@echo "✓ Clean complete."

docker-build:
	@echo "Building Docker image..."
	@docker build -t elastic-peek .
	@echo "✓ Docker image built. Run 'make docker-run' to start the container."

docker-run:
	@echo "Starting Docker container..."
	@echo "  Dashboard: http://localhost:8080"
	@echo "  Proxying /_es/* and /_query → $${ES_URL:-http://host.docker.internal:9200}"
	@echo "  Connect the dashboard to: http://localhost:8080"
	@docker run --rm -p 8080:80 -e ES_URL=$${ES_URL:-http://host.docker.internal:9200} elastic-peek

otel-harness-up:
	@echo "Starting Elasticsearch + OTel host metrics harness..."
	@docker compose -f docker-compose.otel-harness.yml up -d
	@echo "✓ Harness running. Elasticsearch: http://localhost:9200"

otel-harness-down:
	@echo "Stopping OTel host metrics harness..."
	@docker compose -f docker-compose.otel-harness.yml down -v
	@echo "✓ Harness stopped."

otel-harness-logs:
	@docker compose -f docker-compose.otel-harness.yml logs -f otel-collector

otel-cloud-up:
	@echo "Starting OTel harness → remote Elastic cluster..."
	@docker compose -f docker-compose.otel-harness.yml -f docker-compose.otel-cloud.yml up -d
	@echo "✓ Sending traces, metrics, and logs to $${ES_URL}"

otel-cloud-down:
	@echo "Stopping remote OTel harness..."
	@docker compose -f docker-compose.otel-harness.yml -f docker-compose.otel-cloud.yml down -v
	@echo "✓ Stopped."

otel-cloud-logs:
	@docker compose -f docker-compose.otel-harness.yml -f docker-compose.otel-cloud.yml logs -f otel-collector
